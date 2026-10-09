import { randomUUID } from 'node:crypto';
import { userId, sessionCookie, assertSameOrigin } from '@/lib/user';
import { db } from '@/lib/db';
import {
  chinaDate,
  cartTotals,
  evaluate,
  solveCandidates,
  hash,
  normalizeMissionTitle,
} from '@/lib/game';
import {
  getProfile,
  saveProfile,
  dailyMissions,
  getMission,
  stats,
  putSnapshot,
  getSnapshot,
  saveQuote,
  getQuote,
  complete,
  newQuoteId,
  type CachedMenu,
} from '@/lib/repository';
import { callTool, connectionStatus, connectionKey, assertSafeData } from '@/lib/mcp';
import { previewAction } from '@/lib/actions';
import {
  normalizeStores,
  normalizeMenu,
  normalizeEvents,
  normalizePrice,
  businessData,
} from '@/lib/mcd-normalize';
import type { Store, CartItem, Bootstrap, Mode, Quote } from '@/lib/types';
import { DEMO_PRODUCTS } from '@/lib/demo-tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ action: string[] }> };
type Raw = Record<string, any>;
async function bootstrap(id: string): Promise<Bootstrap> {
  return {
    profile: getProfile(id),
    missions: dailyMissions(id),
    stats: stats(id),
    date: chinaDate(),
    connection: connectionStatus(id),
  };
}
function json(body: unknown, status = 200, cookie?: string) {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return Response.json(body, { status, headers });
}
async function body(request: Request): Promise<Raw> {
  const content = await request.text();
  if (content.length > 60000) throw new Error('请求过大');
  const parsed = content ? JSON.parse(content) : {};
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object')
    throw new Error('请求格式无效');
  assertSafeData(parsed);
  return parsed;
}
function businessArgs(store: Store) {
  const beType = store.beType || 1;
  const orderType = beType === 1 || beType === 5 ? 1 : 2;
  if (beType !== 1 && !store.beCode) throw new Error('当前取餐方式需要从门店查询取得业务编码');
  return {
    storeCode: store.storeCode,
    beType,
    orderType,
    ...(beType === 1 ? {} : { beCode: store.beCode }),
  };
}
async function resolvedStore(id: string, input: unknown): Promise<Store> {
  if (!input || typeof input !== 'object') throw new Error('请先选择补给门店');
  const value = input as Store;
  const stores = getSnapshot<Store[]>(id, `${id}:${connectionKey(id)}:stores`, 15 * 60000);
  const selected = stores?.find(
    (s) =>
      s.storeCode === value.storeCode &&
      (s.beType || 1) === (value.beType || 1) &&
      s.beCode === value.beCode,
  );
  if (!selected) throw new Error('请重新查询并选择门店，不能使用过期或自行填写的门店信息');
  if (!selected.businessStatus) throw new Error('这家门店当前暂停营业，请选择其他补给站');
  return selected;
}
async function menu(id: string, store: Store, refresh = false): Promise<CachedMenu> {
  const sessionKey = connectionKey(id);
  const mode = connectionStatus(id).mode;
  const key = `${id}:${sessionKey}:menu:${store.storeCode}:${store.beType || 1}:${store.beCode || ''}`;
  const cached = refresh ? null : getSnapshot<CachedMenu>(id, key);
  if (cached) return cached;
  const [raw, nutrition, coupons] = await Promise.all([
    callTool(id, 'query-meals', businessArgs(store)),
    callTool(id, 'list-nutrition-foods', {}),
    callTool(id, 'query-store-coupons', businessArgs(store)),
  ]);
  const couponData = businessData(coupons);
  if (sessionKey !== connectionKey(id)) throw new Error('账户连接已改变，请重新查询菜单');
  const result = {
    products: normalizeMenu(raw, nutrition).map((p) => ({ ...p, source: mode })),
    coupons: Array.isArray(couponData) ? couponData : [],
    source: mode,
    store,
  };
  putSnapshot(id, key, result);
  return result;
}
async function hydrateItems(id: string, store: Store, items: CartItem[]) {
  const hydrated: CartItem[] = [];
  for (const item of items) {
    const detail = (await callTool(id, 'query-meal-detail', {
      ...businessArgs(store),
      code: item.productCode,
    })) as Raw;
    const data = businessData(detail) || {};
    const chosen = { ...item };
    if (Array.isArray(data.rounds) && data.rounds.length && !chosen.roundList) {
      chosen.roundList = data.rounds.map((r: Raw) => ({
        round: String(r.id),
        comboItemList: (r.choices || [])
          .filter((c: Raw) => c.isDefault === 1)
          .map((c: Raw) => ({ code: c.code, quantity: c.quantity || 1 })),
      }));
      if (chosen.roundList?.some((r: any) => !r.comboItemList.length))
        throw new Error('这个套餐需要先选择子项，请在套餐详情中完成搭配');
    }
    hydrated.push(chosen);
  }
  return hydrated;
}
function attachCoupons(items: CartItem[], coupons: unknown[]): CartItem[] {
  const used = new Set<string>();
  return items.map((item) => {
    const eligible = (coupons as Raw[]).find(
      (c) =>
        c.couponId &&
        !used.has(c.couponId) &&
        (c.products || []).some((p: Raw) => p.productCode === item.productCode) &&
        (!item.couponId || c.couponId === item.couponId),
    );
    if (item.couponId && !eligible) throw new Error('这张券与当前门店餐品不匹配，请重新选择');
    if (!eligible) return item;
    used.add(eligible.couponId);
    return {
      ...item,
      couponId: eligible.couponId,
      ...(eligible.couponCode ? { couponCode: eligible.couponCode } : {}),
    };
  });
}
async function quote(
  id: string,
  missionId: string,
  store: Store,
  rawItems: unknown,
): Promise<Quote> {
  const sessionKey = connectionKey(id);
  if (!Array.isArray(rawItems) || !rawItems.length || rawItems.length > 20)
    throw new Error('请选择1至20项餐品');
  const items = rawItems as CartItem[];
  const mission = getMission(id, missionId);
  const currentMenu = await menu(id, store);
  cartTotals(items, currentMenu.products);
  const normalized = await hydrateItems(id, store, attachCoupons(items, currentMenu.coupons));
  let gmServiceCode: string | undefined;
  if (store.beType === 6) {
    throw new Error('团餐请进入小队远征，先选择助餐服务再验价');
  }
  const raw = await callTool(id, 'calculate-price', {
    ...businessArgs(store),
    items: normalized,
    ...(gmServiceCode ? { gmServiceCode } : {}),
    needTableware: false,
  });
  if (sessionKey !== connectionKey(id)) throw new Error('账户连接已改变，请重新验价');
  const price = normalizePrice(raw);
  const result: Quote = {
    id: newQuoteId(),
    ...price,
    items: normalized,
    source: currentMenu.source,
    store,
    verifiedAt: new Date().toISOString(),
    evaluation: evaluate(mission, normalized, currentMenu.products, price.price),
  };
  saveQuote(id, missionId, result, sessionKey);
  return result;
}

export async function GET(request: Request, context: Context) {
  try {
    const action = (await context.params).action.join('/');
    let id: string;
    try {
      id = userId(request);
    } catch {
      if (action !== 'bootstrap' && action !== 'shared')
        return json({ error: '请先打开任务大厅' }, 401);
      id = randomUUID();
    }
    if (action === 'bootstrap') return json(await bootstrap(id), 200, sessionCookie(id, request));
    const mode = connectionStatus(id).mode;
    if (action === 'stores') {
      const sessionKey = connectionKey(id);
      const url = new URL(request.url);
      const profile = getProfile(id);
      const beType = Number(url.searchParams.get('beType') || 1);
      if (beType !== 1 && beType !== 5) throw new Error('普通门店选到店自取，得来速选车道取餐');
      const raw = await callTool(id, 'query-nearby-stores', {
        searchType: 2,
        city: url.searchParams.get('city') || profile.city,
        keyword: url.searchParams.get('keyword') || profile.location,
        beType,
      });
      if (sessionKey !== connectionKey(id)) throw new Error('账户连接已改变，请重新查询门店');
      const stores = normalizeStores(raw, beType).map((s) => ({ ...s, beType: beType as 1 | 5 }));
      putSnapshot(id, `${id}:${sessionKey}:stores`, stores);
      return json({ stores, source: mode });
    }
    if (action === 'events') {
      const raw = await callTool(id, 'campaign-calendar', {});
      return json({ events: normalizeEvents(raw), source: mode });
    }
    if (action === 'challenge') {
      const missionId = new URL(request.url).searchParams.get('missionId') || '';
      const mission = getMission(id, missionId);
      const cached = db()
        .prepare(
          'SELECT id,payload FROM snapshots WHERE user_id=? ORDER BY created_at DESC LIMIT 30',
        )
        .all(id) as { id: string; payload: string }[];
      const found = cached
        .filter((r) => r.id.startsWith(`${id}:${connectionKey(id)}:menu:`))
        .map((r) => JSON.parse(r.payload))
        .find((s: Raw) => Array.isArray(s.products) && s.source === mode);
      const products =
        found?.products ??
        DEMO_PRODUCTS.map((p) => ({
          code: p.code,
          name: p.name,
          price: p.cents,
          category: p.category,
          ...(p.code === 'D501' ? {} : { kcal: p.kcal, protein: p.protein }),
          tags: [],
          mealSlots: p.mealSlots,
          emoji: p.emoji,
          source: 'demo',
          nutritionMatched: p.code !== 'D501',
        }));
      const source = found ? mode : 'demo';
      const { seed, id: privateMissionId, ...withoutIdentity } = mission;
      void seed;
      const challengeCode = hash(`${privateMissionId}:${JSON.stringify(products)}`).slice(0, 16);
      const publicMission = {
        ...withoutIdentity,
        id: `shared-${challengeCode}`,
        status: 'available',
        reward: 0,
      };
      const candidate =
        solveCandidates(mission, products)
          .solutions.filter((s) => evaluate(mission, s.items, products, s.price).passed)
          .sort((a, b) => b.score - a.score)[0] || null;
      const snapshot = {
        code: challengeCode,
        mission: publicMission,
        products,
        source,
        baseline: candidate,
      };
      db()
        .prepare('INSERT OR IGNORE INTO challenges VALUES (?,?,?)')
        .run(challengeCode, JSON.stringify(snapshot), new Date().toISOString());
      return json({
        version: 1,
        challengeCode,
        mission: publicMission,
        mode: source,
        shareUrl: `/challenge/${challengeCode}`,
        notice: '好友挑战使用冻结的菜单标价，不代表实时可购买价格，不涉及消费或官方积分。',
      });
    }
    if (action === 'shared') {
      const code = new URL(request.url).searchParams.get('code') || '';
      const row = db().prepare('SELECT payload FROM challenges WHERE code=?').get(code) as
        { payload: string } | undefined;
      if (!row) return json({ error: '挑战卡不存在，请让朋友重新分享' }, 404);
      const snapshot = JSON.parse(row.payload);
      snapshot.mission = normalizeMissionTitle(snapshot.mission);
      return json(snapshot);
    }
    if (action === 'rooms') {
      const roomId = new URL(request.url).searchParams.get('id') || '';
      const row = db().prepare('SELECT payload FROM rooms WHERE id=?').get(roomId) as
        { payload: string } | undefined;
      if (!row) return json({ error: '小队不存在' }, 404);
      return json(JSON.parse(row.payload));
    }
    return json({ error: '页面不存在' }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '查询失败' }, 400);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const action = (await context.params).action.join('/');
    const input = await body(request);
    if (action === 'shared/evaluate') {
      const row = db()
        .prepare('SELECT payload FROM challenges WHERE code=?')
        .get(String(input.code)) as { payload: string } | undefined;
      if (!row) throw new Error('挑战卡不存在');
      const snapshot = JSON.parse(row.payload);
      if (!Array.isArray(input.items) || !input.items.length || input.items.length > 20)
        throw new Error('请选择有效餐品组合');
      const totals = cartTotals(input.items, snapshot.products);
      const evaluation = evaluate(snapshot.mission, input.items, snapshot.products, totals.price);
      return json({
        price: totals.price,
        evaluation,
        baseline: snapshot.baseline,
        beatAI:
          Boolean(snapshot.baseline) &&
          evaluation.passed &&
          evaluation.score > snapshot.baseline.score,
      });
    }
    const id = userId(request);
    if (action === 'profile') {
      saveProfile(id, input);
      return json(await bootstrap(id));
    }
    if (action === 'persona') {
      const fresh = randomUUID();
      return json(await bootstrap(fresh), 200, sessionCookie(fresh, request));
    }
    if (action === 'menu') {
      return json(await menu(id, await resolvedStore(id, input.store), true));
    }
    if (action === 'quote')
      return json(
        await quote(
          id,
          String(input.missionId || ''),
          await resolvedStore(id, input.store),
          input.items,
        ),
      );
    if (action === 'solve') {
      const mission = getMission(id, String(input.missionId || ''));
      const store = await resolvedStore(id, input.store);
      const currentMenu = await menu(id, store);
      const solved = solveCandidates(mission, currentMenu.products);
      const verified = [];
      const errors = [];
      for (const candidate of solved.solutions) {
        try {
          const checked = await quote(id, mission.id, store, candidate.items);
          if (checked.evaluation.passed)
            verified.push({
              ...candidate,
              price: checked.price,
              kcal: checked.evaluation.kcal,
              protein: checked.evaluation.protein,
              coverage: checked.evaluation.coverage,
              score: checked.evaluation.score,
              items: checked.items,
              officialVerified: checked.source === 'live',
              quote: checked,
            });
        } catch (e) {
          errors.push(e instanceof Error ? e.message : '暂无法验价');
        }
      }
      return json({
        solutions: verified,
        searched: solved.searched,
        message: verified.length
          ? '候选解已经验价，结果限于当前搜索范围'
          : errors[0] || '当前菜单中没有满足全部条件的候选。可尝试其他门店或明日调整预算。',
      });
    }
    if (action === 'complete') {
      const mode = connectionStatus(id).mode;
      const reward = complete(
        id,
        String(input.missionId),
        String(input.quoteId),
        mode,
        connectionKey(id),
      );
      return json({ bootstrap: await bootstrap(id), reward });
    }
    if (action === 'checkout') {
      const { quote: checked, sessionKey } = getQuote(id, String(input.quoteId));
      const mode = connectionStatus(id).mode;
      if (sessionKey !== connectionKey(id)) throw new Error('账户连接已改变，请重新验价');
      if (checked.source !== mode) throw new Error('数据模式已改变，请重新验价');
      if (!checked.takeWays.some((t) => t.code === input.takeWayCode))
        throw new Error('请选择报价返回的取餐方式');
      return json(
        await previewAction(id, 'create-order', {
          ...businessArgs(checked.store),
          items: checked.items,
          takeWayCode: input.takeWayCode,
          needTableware: false,
        }),
      );
    }
    if (action === 'rooms') {
      const roomId = randomUUID().slice(0, 8);
      const profile = getProfile(id);
      const room = {
        id: roomId,
        name: String(input.name || '夜航补给小队').slice(0, 30),
        members: [
          {
            id,
            name: profile.name,
            preferences: profile.preferences,
            budget: profile.budgets.dinner,
          },
        ],
        version: 1,
      };
      db()
        .prepare('INSERT INTO rooms VALUES (?,?,?,?)')
        .run(roomId, id, JSON.stringify(room), new Date().toISOString());
      return json(room);
    }
    if (action === 'rooms/join') {
      const row = db().prepare('SELECT payload FROM rooms WHERE id=?').get(String(input.id)) as
        { payload: string } | undefined;
      if (!row) throw new Error('小队邀请码不存在');
      const room = JSON.parse(row.payload);
      const profile = getProfile(id);
      if (!room.members.some((m: Raw) => m.id === id)) {
        if (room.members.length >= 12) throw new Error('小队已经满员');
        room.members.push({
          id,
          name: profile.name,
          preferences: profile.preferences,
          budget: profile.budgets.dinner,
        });
        room.version++;
        db()
          .prepare('UPDATE rooms SET payload=?,updated_at=? WHERE id=?')
          .run(JSON.stringify(room), new Date().toISOString(), String(input.id));
      }
      return json(room);
    }
    return json({ error: '操作不存在' }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '操作失败' }, 400);
  }
}
