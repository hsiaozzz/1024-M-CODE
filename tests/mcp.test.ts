import { before } from 'node:test';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { callTool, connectionStatus, listTools, observations, unwrapMcpResult } from '../lib/mcp';
import { executeAction, previewAction } from '../lib/actions';
import {
  normalizeEvents,
  normalizeMenu,
  normalizePrice,
  parseDataText,
} from '../lib/mcd-normalize';
import { db } from '../lib/db';
import { demoCall } from '../lib/demo-tools';

before(() => {
  process.env.MCMISSIONS_DATA_DIR = mkdtempSync(join(tmpdir(), 'mcmissions-mcp-'));
});
const store = { storeCode: '3450082', beType: 1, orderType: 1 };
async function menu(user: string) {
  await callTool(user, 'query-nearby-stores', {
    beType: 1,
    searchType: 2,
    city: '成都市',
    keyword: '世外桃源酒店',
  });
  return callTool(user, 'query-meals', store);
}
test('35 tools, default isolated demo, dynamic schemas and write gateway', async () => {
  const user = randomUUID();
  const tools = await listTools(user);
  assert.equal(tools.length, 35);
  assert.equal(tools.filter((t) => t.write).length, 7);
  assert.equal(connectionStatus(user).mode, 'demo');
  await assert.rejects(callTool(user, 'draw-lottery', {}), /必须先预览/);
  await assert.rejects(
    callTool(user, 'query-nearby-stores', { beType: 2, searchType: 2 }),
    /参数不符合/,
  );
  await assert.rejects(callTool(user, 'query-meals', store), /先查询/);
  await menu(user);
  await assert.rejects(
    callTool(
      user,
      'query-meals',
      JSON.parse(
        '{"storeCode":"3450082","beType":1,"orderType":1,"constructor":{"prototype":{"polluted":true}}}',
      ),
    ),
    /原型字段/,
  );
  assert.equal(({} as any).polluted, undefined);
  await assert.rejects(
    callTool(user, 'query-meal-detail', { ...store, code: 'constructor' }),
    /选择餐品/,
  );
  await assert.rejects(callTool(user, 'query-meals', { ...store, beCode: 'wrong' }), /不应传/);
  await assert.rejects(callTool(user, 'query-promotions', store), /参数不符合/);
});
test('safe structured, markdown JSON and TOON decoding; business failures propagate', () => {
  assert.deepEqual(
    parseDataText('# Fields\n\n## Original Response\n\n{"code":200,"data":{"price":2500}}'),
    { code: 200, data: { price: 2500 } },
  );
  assert.equal(
    parseDataText('[1]{productName,energyKcal,protein}:\n  板烧鸡腿堡,391,23')[0].protein,
    23,
  );
  assert.deepEqual(
    unwrapMcpResult({
      content: [{ type: 'text', text: '## Original Response\n{"code":200,"data":[1]}' }],
    }).data,
    [1],
  );
  assert.throws(
    () => unwrapMcpResult({ structuredContent: { code: 401, message: '权限不足' } }),
    /权限不足/,
  );
  assert.throws(
    () =>
      unwrapMcpResult({
        structuredContent: {
          code: 200,
          data: { status: { code: 'NO_STOCK', message: '奖品缺货' } },
        },
      }),
    /奖品缺货/,
  );
});
test('menu cents, nutrition exact-match only, conditional price and unknown nutrition', async () => {
  const user = randomUUID();
  const m = await menu(user),
    n = await callTool(user, 'list-nutrition-foods', {});
  const products = normalizeMenu(m, n);
  assert.equal(products.find((p) => p.code === 'D101')?.price, 1650);
  assert.equal(products.find((p) => p.code === 'D101')?.nutritionMatched, true);
  assert.equal(products.find((p) => p.code === 'D501')?.nutritionMatched, false);
  const detail = await callTool(user, 'query-meal-detail', { ...store, code: 'D501' });
  assert.equal(detail.data.rounds.length, 2);
  const changed = await callTool(user, 'calculate-price', {
    ...store,
    items: [
      {
        productCode: 'D501',
        quantity: 1,
        roundList: [
          { round: '1', comboItemList: [{ code: 'D101', quantity: 2 }] },
          { round: '2', comboItemList: [{ code: 'D303', quantity: 2 }] },
        ],
      },
    ],
  });
  assert.equal(changed.data.price, 5200);
  const custom = normalizeMenu(
    {
      data: {
        meals: {
          p: {
            name: '麦辣鸡腿堡套餐',
            currentPrice: '15',
            originalPrice: '28',
            canWithOrder: true,
          },
          z: { name: '麦辣鸡腿汉堡', currentPrice: '12.5' },
        },
      },
    },
    { data: '[1]{productName,energyKcal,protein}:\n  麦辣鸡腿汉堡,485,24' },
  );
  assert.equal(custom[0].price, 2800);
  assert.equal(custom[0].nutritionMatched, false);
  assert.equal(custom[1].price, 1250);
  assert.equal(custom[1].protein, 24);
  assert.ok(custom[1].tags.includes('辣'));
  const actual = normalizeMenu(
    {
      data: {
        meals: Object.fromEntries(
          ['巨无霸', '麦香鸡', '麦香鱼', '酥酥多笋卷', '咖啡阿芙佳朵'].map((name, index) => [
            String(index),
            { name, currentPrice: '10' },
          ]),
        ),
      },
    },
    { data: [] },
  );
  assert.deepEqual(
    actual.map((p) => p.category),
    ['main', 'main', 'main', 'main', 'dessert'],
  );
  assert.equal(
    normalizeEvents({
      data: {
        dailyList: [
          {
            date: '2026-10-09',
            events: [
              {
                activityTitle: '',
                activitySubTitle: '',
                articleDto: { title: '活动', content: '<p>细节</p>' },
              },
            ],
          },
        ],
      },
    })[0].description,
    '细节',
  );
  assert.throws(() => normalizePrice({ data: { price: 12.5 } }), /有效/);
});
test('coupon confirmation changes only selected user and repeats once', async () => {
  const a = randomUUID(),
    b = randomUUID();
  const p = await previewAction(a, 'auto-bind-coupons', {});
  const results = await Promise.allSettled([
    executeAction(a, p.confirmationId),
    executeAction(a, p.confirmationId),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const repeat = await executeAction(a, p.confirmationId);
  assert.equal(repeat.data.successCount, 1);
  assert.equal((await callTool(a, 'query-my-coupons', {})).data.totalCount, 1);
  assert.equal((await callTool(b, 'query-my-coupons', {})).data.totalCount, 0);
  await assert.rejects(executeAction(b, p.confirmationId), /不属于/);
});
test('order preview recalculates official price and checks takeWay; no duplicate order', async () => {
  const user = randomUUID();
  await menu(user);
  const args = { ...store, items: [{ productCode: 'D101', quantity: 1 }], takeWayCode: 'PICKUP' };
  await assert.rejects(
    previewAction(user, 'create-order', { ...args, takeWayCode: 'invented' }),
    /报价提供/,
  );
  const p = await previewAction(user, 'create-order', args);
  assert.equal(p.consumption.price, 1650);
  const result = await executeAction(user, p.confirmationId);
  assert.match(result.data.orderId, /DEMO-ORDER/);
  assert.equal((await callTool(user, 'order-list', {})).data.list.length, 1);
  await executeAction(user, p.confirmationId);
  assert.equal((await callTool(user, 'order-list', {})).data.list.length, 1);
  const cancel = await previewAction(user, 'cancel-order', {
    orderId: result.data.orderId,
    cancelReasonCode: '1',
  });
  await executeAction(user, cancel.confirmationId);
  assert.equal(
    (await callTool(user, 'query-order', { orderId: result.data.orderId })).data.orderStatus,
    '7',
  );
});
test('lottery uses nextConsumption and refuses stale consumption', async () => {
  const user = randomUUID();
  const p = await previewAction(user, 'draw-lottery', {});
  assert.equal(p.consumption.type, 'CHANCES');
  assert.match(p.summary, /本次优先消耗次数/);
  await executeAction(user, p.confirmationId);
  assert.equal((await callTool(user, 'query-lottery-info', {})).data.availableTimes, 0);
  assert.equal((await callTool(user, 'query-my-account', {})).data.availablePoint, '3600');
  const p2 = await previewAction(user, 'draw-lottery', {});
  assert.equal(p2.consumption.points, '100');
  await executeAction(user, p2.confirmationId);
  assert.equal((await callTool(user, 'query-my-account', {})).data.availablePoint, '3500');
  const p3 = await previewAction(user, 'draw-lottery', {});
  assert.notEqual(p3.confirmationId, p2.confirmationId);
  assert.equal(p3.consumption.points, '100');
  assert.equal((await callTool(user, 'query-my-account', {})).data.availablePoint, '3500');
});
test('mall shop/SKU provenance and points; party progressive dependencies', async () => {
  const user = randomUUID();
  await assert.rejects(callTool(user, 'mall-product-detail', { spuId: 201 }), /先查询商城/);
  await callTool(user, 'mall-points-products', {});
  await callTool(user, 'mall-product-detail', { spuId: 201 });
  const p = await previewAction(user, 'mall-create-order', {
    skuId: 2010,
    spuCategory: '1',
    count: 1,
  });
  await executeAction(user, p.confirmationId);
  assert.equal((await callTool(user, 'query-my-account', {})).data.availablePoint, '3100');
  await callTool(user, 'mall-product-detail', { spuId: 501 });
  await assert.rejects(
    previewAction(user, 'mall-create-order', { skuId: 5010, spuCategory: '1' }),
    /普通积分兑换/,
  );
  await assert.rejects(
    callTool(user, 'query-party-store', { spuId: 501, code: '510100' }),
    /先查询活动城市/,
  );
  await callTool(user, 'query-party-city', { spuId: 501 });
  await callTool(user, 'query-party-store', { spuId: 501, code: '510100' });
  await callTool(user, 'query-party-store-date', { spuId: 501, storeCode: '3450082' });
  const dates = (
    await callTool(user, 'query-party-store-date', { spuId: 501, storeCode: '3450082' })
  ).data;
  const sessions = (
    await callTool(user, 'query-party-store-session', {
      spuId: 501,
      storeCode: '3450082',
      dateStr: dates[0].date,
    })
  ).data;
  const s = sessions[0];
  const pp = await previewAction(user, 'party-order-create', {
    spuId: 501,
    skuId: 5010,
    partyType: 2,
    code: '510100',
    storeCode: '3450082',
    dateStr: dates[0].date,
    id: s.id,
    timeStart: s.timeStart,
    timeEnd: s.timeEnd,
    leftNum: s.leftNum,
    count: 1,
  });
  await executeAction(user, pp.confirmationId);
  assert.equal((await callTool(user, 'query-my-account', {})).data.availablePoint, '2300');
});
test('uncertain actions remain locked and expired/changed connection cannot submit', async () => {
  const user = randomUUID();
  const p = await previewAction(user, 'auto-bind-coupons', {});
  db()
    .prepare("UPDATE mcp_actions SET state='uncertain',error='请核实' WHERE id=?")
    .run(p.confirmationId);
  await assert.rejects(executeAction(user, p.confirmationId), /请核实/);
  await assert.rejects(previewAction(user, 'auto-bind-coupons', {}), /结果不确定/);
  const other = randomUUID();
  const expired = await previewAction(other, 'auto-bind-coupons', {});
  db()
    .prepare('UPDATE mcp_actions SET expires_at=? WHERE id=?')
    .run(Date.now() - 1, expired.confirmationId);
  await assert.rejects(executeAction(other, expired.confirmationId), /过期/);
});
test('all 35 demo scenes form valid account, delivery, mall and party journeys', async () => {
  const user = randomUUID(),
    seen = new Set<string>();
  const read = async (name: string, args: Record<string, unknown> = {}) => {
    seen.add(name);
    return callTool(user, name, args);
  };
  const write = async (name: string, args: Record<string, unknown> = {}) => {
    seen.add(name);
    const p = await previewAction(user, name, args);
    return executeAction(user, p.confirmationId);
  };
  await read('query-nearby-stores', {
    beType: 1,
    searchType: 2,
    city: '成都市',
    keyword: '世外桃源酒店',
  });
  await read('now-time-info');
  await read('campaign-calendar');
  await read('query-meals', store);
  await read('query-meal-detail', { ...store, code: 'D101' });
  await read('list-nutrition-foods');
  await read('available-coupons');
  await write('auto-bind-coupons');
  await read('query-my-coupons');
  await read('query-store-coupons', store);
  await write('delivery-create-address', {
    city: '成都市',
    contactName: '测试用户',
    phone: '13800000001',
    address: '测试酒店',
    addressDetail: '1号',
  });
  const addresses = await read('delivery-query-addresses');
  const addressId = addresses.data.addresses[0].addressId;
  const stores = await read('delivery-query-stores', { addressId, beType: 6 });
  const delivery = {
    storeCode: stores.data[0].storeCode,
    beCode: stores.data[0].beCode,
    beType: 6,
    orderType: 2,
  };
  await read('query-meals', delivery);
  await read('query-promotions', delivery);
  const gm = await read('query-meal-assistance', delivery);
  const args = {
    ...delivery,
    items: [{ productCode: 'D101', quantity: 6 }],
    gmServiceCode: gm.data.mealAssistanceItems[0].gmServiceCode,
  };
  await read('calculate-price', args);
  const order = await write('create-order', { ...args, addressId });
  await read('order-list');
  await read('query-order', { orderId: order.data.orderId });
  await read('query-survey-coupon', { orderId: order.data.orderId });
  await write('cancel-order', { orderId: order.data.orderId, cancelReasonCode: '1' });
  await read('query-my-account');
  await read('mall-points-products');
  await read('mall-product-detail', { spuId: 202 });
  const mall = await write('mall-create-order', {
    skuId: 2020,
    spuCategory: '2',
    count: 1,
    addressId,
  });
  await read('mall-order-list');
  await read('mall-order-detail', { orderId: mall.data.orderId });
  await read('mall-product-detail', { spuId: 501 });
  await read('query-party-city', { spuId: 501 });
  await read('query-party-store', { spuId: 501, code: '510100' });
  const dates = await read('query-party-store-date', { spuId: 501, storeCode: '3450082' });
  const dateStr = dates.data[0].date;
  const session = (
    await read('query-party-store-session', { spuId: 501, storeCode: '3450082', dateStr })
  ).data[0];
  await write('party-order-create', {
    spuId: 501,
    skuId: 5010,
    partyType: 2,
    code: '510100',
    storeCode: '3450082',
    dateStr,
    id: session.id,
    timeStart: session.timeStart,
    timeEnd: session.timeEnd,
    leftNum: session.leftNum,
    count: 1,
  });
  await read('query-lottery-info');
  await write('draw-lottery');
  await read('query-my-prizes');
  assert.equal(seen.size, 35);
});
test('a live write timeout is never retried and keeps a persistent uncertainty lock', async () => {
  const user = randomUUID();
  let writes = 0;
  const tools = await listTools(user);
  const globals = globalThis as any;
  globals.mcMcpSessions.set(user, {
    id: 'test-live-session',
    client: {
      callTool: async ({ name, arguments: args }: any) => {
        if (name === 'create-order') {
          writes++;
          throw new Error('timeout');
        }
        return { structuredContent: demoCall(user, name, args) };
      },
    },
    tools,
    names: new Map(tools.map((t) => [t.name, t.name])),
    validators: new Map(tools.map((t) => [t.name, () => true])),
  });
  try {
    await menu(user);
    const p = await previewAction(user, 'create-order', {
      ...store,
      items: [{ productCode: 'D101', quantity: 1 }],
      takeWayCode: 'PICKUP',
    });
    await assert.rejects(executeAction(user, p.confirmationId), /结果不确定/);
    await assert.rejects(executeAction(user, p.confirmationId), /结果不确定/);
    assert.equal(writes, 1);
    assert.equal(
      (db().prepare('SELECT state FROM mcp_actions WHERE id=?').get(p.confirmationId) as any).state,
      'uncertain',
    );
    assert.ok(db().prepare('SELECT action_id FROM mcp_action_locks WHERE user_id=?').get(user));
  } finally {
    globals.mcMcpSessions.delete(user);
  }
});
test('an in-flight old-account read cannot populate the new-account observations', async () => {
  const user = randomUUID(),
    tools = await listTools(user),
    globals = globalThis as any;
  let release: (value: any) => void = () => {};
  let started: () => void = () => {};
  const invoked = new Promise<void>((resolve) => {
    started = resolve;
  });
  const response = new Promise<any>((resolve) => {
    release = resolve;
  });
  const session = {
    id: 'account-A',
    client: {
      callTool: async () => {
        started();
        return response;
      },
    },
    tools,
    names: new Map(tools.map((t) => [t.name, t.name])),
    validators: new Map(tools.map((t) => [t.name, () => true])),
  };
  globals.mcMcpSessions.set(user, session);
  try {
    const read = callTool(user, 'query-my-account', {});
    await invoked;
    globals.mcMcpSessions.set(user, { ...session, id: 'account-B' });
    release({ structuredContent: { code: 200, data: { availablePoint: '999' } } });
    await assert.rejects(read, /账户连接已变更/);
    assert.equal(observations(user, 'query-my-account').length, 0);
  } finally {
    globals.mcMcpSessions.delete(user);
  }
});
