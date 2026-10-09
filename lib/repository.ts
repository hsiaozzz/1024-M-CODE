import { randomUUID } from 'node:crypto';
import { db } from './db';
import { chinaDate, defaultProfile, generateMission, SLOTS } from './game';
import type { Profile, Mission, Bootstrap, Quote, Mode, MenuProduct, Store } from './types';

export function getProfile(id: string): Profile {
  const row = db().prepare('SELECT payload FROM profiles WHERE id=?').get(id) as
    { payload: string } | undefined;
  if (row) return JSON.parse(row.payload);
  const profile = defaultProfile(id);
  db()
    .prepare('INSERT INTO profiles VALUES (?,?,?)')
    .run(id, JSON.stringify(profile), new Date().toISOString());
  return profile;
}
export function saveProfile(id: string, input: Record<string, unknown>) {
  const old = getProfile(id);
  const budgets = input.budgets as Record<string, unknown> | undefined;
  const name = typeof input.name === 'string' ? input.name.trim() : old.name;
  const city = typeof input.city === 'string' ? input.city.trim() : old.city;
  const location = typeof input.location === 'string' ? input.location.trim() : old.location;
  if (!name || name.length > 30 || !city || city.length > 50 || !location || location.length > 150)
    throw new Error('请填写有效昵称、城市和位置');
  const profile: Profile = { ...old, name, city, location };
  if (budgets)
    for (const slot of SLOTS) {
      const n = Number(budgets[slot]);
      if (!Number.isSafeInteger(n) || n < 500 || n > 100000)
        throw new Error('每餐预算应为5至1000元，以整数分提交');
      profile.budgets[slot] = n;
    }
  if (input.preferences !== undefined) {
    if (
      !Array.isArray(input.preferences) ||
      input.preferences.length > 8 ||
      input.preferences.some((x) => typeof x !== 'string' || x.length > 20)
    )
      throw new Error('口味偏好无效');
    profile.preferences = input.preferences;
  }
  for (const field of ['calorieTarget', 'proteinTarget'] as const)
    if (input[field] !== undefined) {
      const n = Number(input[field]);
      const [min, max] = field === 'calorieTarget' ? [200, 2500] : [0, 100];
      if (!Number.isFinite(n) || n < min || n > max) throw new Error('营养目标超出可设置范围');
      profile[field] = n;
    }
  db().prepare('UPDATE profiles SET payload=? WHERE id=?').run(JSON.stringify(profile), id);
  return profile;
}
export function dailyMissions(id: string, date = chinaDate()): Mission[] {
  const profile = getProfile(id);
  for (const slot of SLOTS) {
    const mission = generateMission(profile, date, slot);
    db()
      .prepare('INSERT OR IGNORE INTO missions VALUES (?,?,?,?,?)')
      .run(mission.id, id, date, slot, JSON.stringify(mission));
  }
  const rows = db()
    .prepare(
      `SELECT m.payload,c.mission_id AS done FROM missions m LEFT JOIN completions c ON c.mission_id=m.id WHERE m.user_id=? AND m.date=?`,
    )
    .all(id, date) as { payload: string; done: string | null }[];
  return rows
    .map(
      (r) => ({ ...JSON.parse(r.payload), status: r.done ? 'complete' : 'available' }) as Mission,
    )
    .sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
}
export function getMission(id: string, missionId: string): Mission {
  const row = db()
    .prepare('SELECT payload FROM missions WHERE user_id=? AND id=?')
    .get(id, missionId) as { payload: string } | undefined;
  if (!row) throw new Error('任务不属于当前个人档案');
  return JSON.parse(row.payload);
}
export function stats(id: string): Bootstrap['stats'] {
  const rows = db()
    .prepare(
      'SELECT reward,completed_at FROM completions WHERE user_id=? ORDER BY completed_at DESC',
    )
    .all(id) as { reward: number; completed_at: string }[];
  const dates = new Map<string, number>();
  for (const r of rows) {
    const d = chinaDate(new Date(r.completed_at));
    dates.set(d, (dates.get(d) || 0) + 1);
  }
  let streak = 0;
  const day = new Date(`${chinaDate()}T12:00:00+08:00`);
  if (!dates.has(chinaDate(day))) day.setUTCDate(day.getUTCDate() - 1);
  while (dates.has(chinaDate(day))) {
    streak++;
    day.setUTCDate(day.getUTCDate() - 1);
  }
  const badges: string[] = [];
  if (rows.length) badges.push('初次补给');
  if ([...dates.values()].some((n) => n >= 3)) badges.push('三餐全勤');
  if (streak >= 7) badges.push('七日冒险');
  if (rows.length >= 10) badges.push('城市探索家');
  return { xp: rows.reduce((a, r) => a + r.reward, 0), completed: rows.length, streak, badges };
}
export function putSnapshot(id: string, key: string, payload: unknown) {
  db()
    .prepare('INSERT OR REPLACE INTO snapshots VALUES (?,?,?,?)')
    .run(key, id, JSON.stringify(payload), new Date().toISOString());
}
export function getSnapshot<T>(id: string, key: string, maxAge = 120000): T | null {
  const row = db()
    .prepare('SELECT payload,created_at FROM snapshots WHERE user_id=? AND id=?')
    .get(id, key) as { payload: string; created_at: string } | undefined;
  return row && Date.now() - Date.parse(row.created_at) < maxAge ? JSON.parse(row.payload) : null;
}
export function saveQuote(id: string, missionId: string, quote: Quote, sessionKey?: string) {
  db()
    .prepare('INSERT INTO quotes VALUES (?,?,?,?,?)')
    .run(
      quote.id,
      id,
      missionId,
      JSON.stringify({ ...quote, _sessionKey: sessionKey }),
      new Date().toISOString(),
    );
}
export function getQuote(
  id: string,
  quoteId: string,
): { quote: Quote; missionId: string; sessionKey?: string } {
  const row = db()
    .prepare('SELECT payload,mission_id,created_at FROM quotes WHERE user_id=? AND id=?')
    .get(id, quoteId) as { payload: string; mission_id: string; created_at: string } | undefined;
  if (!row) throw new Error('报价不存在或不属于当前档案');
  if (Date.now() - Date.parse(row.created_at) > 5 * 60000)
    throw new Error('报价已超过5分钟，请重新验价');
  const { _sessionKey, ...quote } = JSON.parse(row.payload);
  return { quote, missionId: row.mission_id, sessionKey: _sessionKey };
}
export function complete(
  id: string,
  missionId: string,
  quoteId: string,
  mode: Mode,
  currentSession?: string,
): number {
  const mission = getMission(id, missionId);
  const { quote, missionId: quotedMission, sessionKey } = getQuote(id, quoteId);
  if (currentSession && sessionKey !== currentSession)
    throw new Error('账户连接已改变，请重新验价');
  if (quotedMission !== missionId || quote.source !== mode)
    throw new Error('报价与任务或数据模式不匹配，请重新验价');
  if (!quote.evaluation.passed) throw new Error('方案尚未满足任务条件');
  if (mission.date !== chinaDate()) throw new Error('这不是今天的任务，无法计入今日进度');
  const result = db()
    .prepare('INSERT OR IGNORE INTO completions VALUES (?,?,?,?,?)')
    .run(missionId, id, quoteId, mission.reward, new Date().toISOString());
  return result.changes ? mission.reward : 0;
}
export function newQuoteId() {
  return randomUUID();
}
export type CachedMenu = {
  products: MenuProduct[];
  coupons: unknown[];
  source: Mode;
  store: Store;
};
