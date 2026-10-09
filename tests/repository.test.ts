import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { db } from '../lib/db';
import { chinaDate, SLOTS } from '../lib/game';
import {
  complete,
  dailyMissions,
  getMission,
  getProfile,
  getQuote,
  saveProfile,
  saveQuote,
  stats,
} from '../lib/repository';
import type { Mission, Quote } from '../lib/types';

let directory: string;
before(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'mcmissions-repository-'));
  process.env.MCMISSIONS_DATA_DIR = directory;
});
after(() => {
  db().close();
  rmSync(directory, { recursive: true, force: true });
});
const shiftedDate = (offset: number) => {
  const date = new Date(`${chinaDate()}T12:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + offset);
  return chinaDate(date);
};
const serverQuote = (entry: Mission, overrides: Partial<Quote> = {}): Quote => ({
  id: randomUUID(),
  price: entry.budget,
  originalPrice: entry.budget,
  discount: 0,
  fees: 0,
  items: [{ productCode: 'verified-main', quantity: 1 }],
  source: 'demo',
  store: {
    storeCode: '3450082',
    storeName: '演示门店',
    address: '测试地址',
    distance: 0,
    businessStatus: true,
    beType: 1,
  },
  verifiedAt: new Date().toISOString(),
  evaluation: { passed: true, checks: [], kcal: 400, protein: 22, coverage: 1, score: 800 },
  takeWays: [{ code: 'PICKUP', title: '到店自取' }],
  ...overrides,
});

test('profile updates cannot reroll persisted daily missions and apply to the following day', () => {
  const user = randomUUID();
  const today = dailyMissions(user);
  assert.equal(today.length, 3);
  assert.deepEqual(
    today.map((entry) => entry.slot),
    SLOTS,
  );
  saveProfile(user, {
    name: '新代号',
    budgets: { breakfast: 500, lunch: 900, dinner: 1100 },
    preferences: ['不吃辣', '蛋白优先'],
    calorieTarget: 500,
    proteinTarget: 10,
  });
  assert.equal(getProfile(user).name, '新代号');
  assert.deepEqual(
    dailyMissions(user),
    today,
    'saving settings must not alter any of the three current quests',
  );
  const tomorrow = dailyMissions(user, shiftedDate(1));
  for (const entry of tomorrow) {
    assert.equal(entry.maxCalories, 500);
    assert.equal(entry.minProtein, 10);
    assert.equal(entry.objective, 'protein');
    assert.deepEqual(entry.preferences, ['不吃辣', '蛋白优先']);
    assert.ok(entry.budget <= getProfile(user).budgets[entry.slot]);
    assert.notEqual(entry.id, today.find((old) => old.slot === entry.slot)?.id);
  }
});

test('failed profile validation leaves the persisted personal settings untouched', () => {
  const user = randomUUID();
  const original = getProfile(user);
  assert.throws(
    () => saveProfile(user, { budgets: { breakfast: 500, lunch: 499, dinner: 3000 } }),
    /预算/,
  );
  assert.throws(() => saveProfile(user, { proteinTarget: 101 }), /营养目标/);
  assert.throws(() => saveProfile(user, { preferences: ['不吃辣', 100] }), /偏好/);
  assert.deepEqual(getProfile(user), original);
});

test('server quotes and missions belong to a single profile and only their matching task and mode can complete', () => {
  const owner = randomUUID(),
    other = randomUUID();
  const [first, second] = dailyMissions(owner);
  const quote = serverQuote(first);
  saveQuote(owner, first.id, quote);
  assert.throws(() => getMission(other, first.id), /不属于/);
  assert.throws(() => getQuote(other, quote.id), /不属于/);
  assert.throws(() => complete(owner, second.id, quote.id, 'demo'), /不匹配/);
  assert.throws(() => complete(owner, first.id, quote.id, 'live'), /不匹配/);
  const copy = getQuote(owner, quote.id).quote;
  copy.evaluation.passed = false;
  copy.price = 0;
  assert.equal(
    getQuote(owner, quote.id).quote.price,
    first.budget,
    'client copies cannot modify the stored official quote',
  );
  assert.equal(complete(owner, first.id, quote.id, 'demo'), first.reward);
});

test('each meal earns its server reward exactly once and three meals unlock the daily badge', () => {
  const user = randomUUID();
  const missions = dailyMissions(user);
  for (const entry of missions) {
    const quote = serverQuote(entry);
    saveQuote(user, entry.id, quote);
    assert.equal(complete(user, entry.id, quote.id, 'demo'), entry.reward);
    assert.equal(complete(user, entry.id, quote.id, 'demo'), 0);
  }
  const result = stats(user);
  assert.equal(result.completed, 3);
  assert.equal(
    result.xp,
    missions.reduce((sum, entry) => sum + entry.reward, 0),
  );
  assert.equal(result.streak, 1);
  assert.ok(result.badges.includes('初次补给'));
  assert.ok(result.badges.includes('三餐全勤'));
  assert.ok(dailyMissions(user).every((entry) => entry.status === 'complete'));
});

test('a live quote cannot survive reconnection to another token even if the mode stays live', () => {
  const user = randomUUID();
  const [entry] = dailyMissions(user);
  const quote = serverQuote(entry, { source: 'live' });
  saveQuote(user, entry.id, quote, 'official-connection-a');
  assert.equal(getQuote(user, quote.id).sessionKey, 'official-connection-a');
  assert.throws(
    () => complete(user, entry.id, quote.id, 'live', 'official-connection-b'),
    /账户连接已改变/,
  );
  assert.equal(stats(user).completed, 0);
  assert.equal(complete(user, entry.id, quote.id, 'live', 'official-connection-a'), entry.reward);
});

test('failed nutrition checks, expired quotations and previous-day missions cannot earn a reward', () => {
  const user = randomUUID();
  const [entry] = dailyMissions(user);
  const failed = serverQuote(entry, {
    evaluation: { passed: false, checks: [], kcal: null, protein: null, coverage: 0, score: 0 },
  });
  saveQuote(user, entry.id, failed);
  assert.throws(() => complete(user, entry.id, failed.id, 'demo'), /尚未满足/);
  const expired = serverQuote(entry);
  saveQuote(user, entry.id, expired);
  db()
    .prepare('UPDATE quotes SET created_at=? WHERE id=?')
    .run(new Date(Date.now() - 301000).toISOString(), expired.id);
  assert.throws(() => getQuote(user, expired.id), /超过5分钟/);
  assert.throws(() => complete(user, entry.id, expired.id, 'demo'), /超过5分钟/);
  const [yesterday] = dailyMissions(user, shiftedDate(-1));
  const oldQuote = serverQuote(yesterday);
  saveQuote(user, yesterday.id, oldQuote);
  assert.throws(() => complete(user, yesterday.id, oldQuote.id, 'demo'), /今天的任务/);
  assert.equal(stats(user).completed, 0);
});
