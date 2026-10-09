import { createHash, randomUUID } from 'node:crypto';
import { db } from './db';
import { businessData, normalizePrice } from './mcd-normalize';
import {
  BusinessError,
  callTool,
  channelArgs,
  connectionKey,
  connectionStatus,
  invokeConfirmedTool,
  observations,
  requireObservation,
  sameChannel,
  UncertainWriteError,
  validateCartContext,
  validateToolArgs,
} from './mcp';
import { canonicalName, WRITE_TOOLS } from './tool-catalog';

const globals = globalThis as typeof globalThis & { mcActionsInitialized?: boolean };
function init() {
  db().exec(
    'CREATE TABLE IF NOT EXISTS mcp_actions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,session_id TEXT NOT NULL,name TEXT NOT NULL,args TEXT NOT NULL,summary TEXT NOT NULL,consumption TEXT,fingerprint TEXT NOT NULL,state TEXT NOT NULL,result TEXT,error TEXT,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS mcp_action_fingerprint ON mcp_actions(user_id,fingerprint); CREATE TABLE IF NOT EXISTS mcp_action_locks (user_id TEXT PRIMARY KEY,action_id TEXT NOT NULL)',
  );
  if (!globals.mcActionsInitialized) {
    db()
      .prepare(
        "UPDATE mcp_actions SET state='uncertain',error='服务重启中断请求，请先核实官方结果' WHERE state='executing'",
      )
      .run();
    globals.mcActionsInitialized = true;
  }
}
const stable = (v: any): string =>
  v === null || typeof v !== 'object'
    ? JSON.stringify(v)
    : Array.isArray(v)
      ? `[${v.map(stable).join(',')}]`
      : `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
          .join(',')}}`;
const dataRows = (r: any): any[] => {
  const d = businessData(r);
  return Array.isArray(d) ? d : (d?.addresses ?? d?.list ?? []);
};
export const cartFingerprint = (args: any) =>
  stable({
    storeCode: args.storeCode,
    beCode: args.beCode ?? '',
    beType: args.beType,
    orderType: args.orderType,
    reservationDate: args.reservationDate ?? '',
    items: args.items,
    withOrder: args.withOrder ?? null,
    needTableware: args.needTableware ?? false,
    gmServiceCode: args.gmServiceCode ?? '',
  });
function address(user: string, addressId: string) {
  return dataRows(
    requireObservation(
      user,
      'delivery-query-addresses',
      (o) => dataRows(o.result).some((a) => String(a.addressId) === addressId),
      '请先查询地址簿并明确选择本人配送地址',
    ).result,
  ).find((a) => String(a.addressId) === addressId);
}
async function validateAction(
  user: string,
  name: string,
  args: any,
): Promise<{ summary: string; consumption?: any }> {
  await validateToolArgs(user, name, args);
  const mode = connectionStatus(user).mode;
  const prefix = mode === 'demo' ? '【演示】不发生真实交易。' : '【真实账户】';
  if (name === 'create-order') {
    channelArgs(args);
    validateCartContext(user, args);
    if (args.orderType === 2) {
      if (!args.addressId) throw new BusinessError('外送和团餐需要选定配送地址');
      address(user, args.addressId);
      requireObservation(
        user,
        'delivery-query-stores',
        (o) =>
          o.args.addressId === args.addressId &&
          o.args.beType === args.beType &&
          dataRows(o.result).some(
            (s) => s.storeCode === args.storeCode && s.beCode === args.beCode,
          ),
        '配送门店必须属于这个地址和渠道',
      );
    }
    const quoteArgs = { ...args };
    delete quoteArgs.addressId;
    delete quoteArgs.takeWayCode;
    delete quoteArgs.remark;
    const price = normalizePrice(await callTool(user, 'calculate-price', quoteArgs));
    if (
      args.orderType === 1 &&
      (!args.takeWayCode || !price.takeWays.some((t) => t.code === args.takeWayCode))
    )
      throw new BusinessError('请选择本次报价提供的取餐方式');
    const menu = businessData(
      requireObservation(
        user,
        'query-meals',
        (o) => sameChannel(o.args, args),
        '菜单已过期，请重新查询',
      ).result,
    );
    const names = args.items
      .map((i: any) => `${menu.meals[i.productCode].name} ×${i.quantity}`)
      .join('、');
    return {
      summary: `${prefix}在门店 ${args.storeCode} 创建${args.orderType === 1 ? '到店' : '配送'}订单：${names}；官方试算 ¥${(price.price / 100).toFixed(2)}（费用 ¥${(price.fees / 100).toFixed(2)}）。${args.addressId ? `配送：${address(user, args.addressId)?.fullAddress ?? args.addressId}。` : ''}${args.reservationDate ? `预约：${args.reservationDate}。` : ''}创建后请到官方支付页面完成付款。`,
      consumption: {
        type: 'ORDER',
        price: price.price,
        fees: price.fees,
        currency: 'CNY',
        source: mode,
      },
    };
  }
  if (name === 'draw-lottery') {
    const info = businessData(await callTool(user, 'query-lottery-info', {}));
    const decision = info?.drawDecision;
    if (!decision?.resourceEligible || !decision.nextConsumption)
      throw new BusinessError(decision?.reason ?? '当前积分或次数不足，不能抽奖');
    const next = decision.nextConsumption;
    if (!['NONE', 'POINTS', 'CHANCES'].includes(next.type))
      throw new BusinessError('抽奖消耗信息不完整，暂不执行');
    return {
      summary: `${prefix}${info.activityName}：${next.text ?? `消耗 ${next.points ?? '0'} 积分 / ${next.chances ?? 0} 次数`}。${decision.fallbackConsumption ? '本次优先消耗次数；次数用完后将改为消耗积分。' : ''}确认仅抽一次，结果不保证中奖。`,
      consumption: {
        ...next,
        activityCode: info.activityCode,
        fallbackConsumption: decision.fallbackConsumption ?? null,
      },
    };
  }
  if (name === 'mall-create-order') {
    const selected = observations(user, 'mall-product-detail').find((o) =>
      businessData(o.result)?.skuList?.some((s: any) => s.skuId === args.skuId),
    );
    if (!selected) throw new BusinessError('请先选择商城商品并查询规格');
    const detail = businessData(
      await callTool(user, 'mall-product-detail', { spuId: businessData(selected.result).spuId }),
    );
    if (detail.shopId !== 2 || String(detail.spuCategory) !== args.spuCategory)
      throw new BusinessError('该商品不属于普通积分兑换，请使用活动预约');
    const sku = detail.skuList?.find((s: any) => s.skuId === args.skuId);
    if (!sku) throw new BusinessError('所选SKU不存在');
    const count = args.count ?? 1;
    if (!Number.isInteger(count) || count < 1 || count > 100)
      throw new BusinessError('兑换数量应为1至100的整数');
    if (args.spuCategory === '2') {
      if (!args.addressId) throw new BusinessError('实物兑换需要收货地址');
      address(user, args.addressId);
    }
    const points = Number(sku.points) * count,
      price = Math.round(Number(sku.price) * 100) * count;
    if (
      sku.points === undefined ||
      sku.points === null ||
      sku.points === '' ||
      sku.price === undefined ||
      sku.price === null ||
      sku.price === '' ||
      !Number.isFinite(points) ||
      points < 0 ||
      !Number.isSafeInteger(price) ||
      price < 0
    )
      throw new BusinessError('规格积分或价格信息不完整');
    const account = businessData(await callTool(user, 'query-my-account', {}));
    if (
      account.availablePoint === undefined ||
      account.availablePoint === null ||
      !Number.isFinite(Number(account.availablePoint))
    )
      throw new BusinessError('未获得有效积分余额');
    if (Number(account.availablePoint) < points) throw new BusinessError('可用积分不足');
    return {
      summary: `${prefix}兑换 ${detail.spuName} ×${count}，规格 ${args.skuId}；消耗 ${points} 积分，现金 ¥${(price / 100).toFixed(2)}。${sku.extTradePrice ? `兑换券核销时还需支付 ¥${sku.extTradePrice}，与本次兑换现金分开。` : ''}${args.addressId ? `收货：${address(user, args.addressId)?.fullAddress ?? args.addressId}。` : ''}`,
      consumption: { type: 'REDEMPTION', points, price, skuId: args.skuId },
    };
  }
  if (name === 'party-order-create') {
    for (const key of [
      'spuId',
      'skuId',
      'partyType',
      'code',
      'storeCode',
      'dateStr',
      'id',
      'timeStart',
      'timeEnd',
      'leftNum',
      'count',
    ])
      if (args[key] === undefined || args[key] === '')
        throw new BusinessError(`请逐步完成活动选择：缺少 ${key}`);
    const selected = requireObservation(
      user,
      'mall-product-detail',
      (o) => businessData(o.result)?.spuId === args.spuId,
      '请先查询并选择活动商品规格',
    );
    const detail = businessData(selected.result);
    if (detail.shopId !== 5 || !detail.skuList?.some((s: any) => s.skuId === args.skuId))
      throw new BusinessError('活动必须是 shopId=5 且规格来自当前详情');
    if (
      ![1, 2].includes(args.partyType) ||
      (detail.partyType !== -1 && detail.partyType !== args.partyType)
    )
      throw new BusinessError('包场/拼团选择与该商品不匹配');
    requireObservation(
      user,
      'query-party-city',
      (o) =>
        o.args.spuId === args.spuId && dataRows(o.result).some((c) => String(c.code) === args.code),
      '请先查询并选择活动城市',
    );
    requireObservation(
      user,
      'query-party-store',
      (o) =>
        o.args.spuId === args.spuId &&
        o.args.code === args.code &&
        dataRows(o.result).some((s) => String(s.code ?? s.storeCode) === args.storeCode),
      '活动门店必须来自所选城市',
    );
    requireObservation(
      user,
      'query-party-store-date',
      (o) =>
        o.args.spuId === args.spuId &&
        o.args.storeCode === args.storeCode &&
        dataRows(o.result).some((d) => d.date === args.dateStr),
      '活动日期必须来自所选门店',
    );
    requireObservation(
      user,
      'query-party-store-session',
      (o) =>
        o.args.spuId === args.spuId &&
        o.args.storeCode === args.storeCode &&
        o.args.dateStr === args.dateStr &&
        dataRows(o.result).some((s) => s.id === args.id),
      '请先查询并选择活动场次',
    );
    const sessions = businessData(
      await callTool(user, 'query-party-store-session', {
        spuId: args.spuId,
        storeCode: args.storeCode,
        dateStr: args.dateStr,
      }),
    );
    const session = (Array.isArray(sessions) ? sessions : []).find((s) => s.id === args.id);
    if (
      !session ||
      session.timeStart !== args.timeStart ||
      session.timeEnd !== args.timeEnd ||
      session.leftNum !== args.leftNum
    )
      throw new BusinessError('场次或余位已变更，请重新选择');
    if (
      !Number.isInteger(args.count) ||
      args.count < 1 ||
      args.count > 100 ||
      args.count > session.leftNum
    )
      throw new BusinessError('人数超过场次当前余位');
    if (
      args.count > (session.partyMax ?? 100) ||
      (args.partyType === 1 && args.count < (session.partyMin ?? 1))
    )
      throw new BusinessError('人数不符合当前场次结构化包场下限或上限');
    if (args.partyTimeInfo) {
      for (const [key, value] of Object.entries(args.partyTimeInfo))
        if (session[key] !== value) throw new BusinessError('partyTimeInfo 必须原样来自所选场次');
    }
    const sku = detail.skuList.find((s: any) => s.skuId === args.skuId);
    const points = Number(sku.points) * args.count,
      price = Math.round(Number(sku.price) * 100) * args.count;
    if (
      sku.points === undefined ||
      sku.points === null ||
      sku.points === '' ||
      sku.price === undefined ||
      sku.price === null ||
      sku.price === '' ||
      !Number.isFinite(points) ||
      points < 0 ||
      !Number.isSafeInteger(price) ||
      price < 0
    )
      throw new BusinessError('活动规格积分或价格不完整');
    const account = businessData(await callTool(user, 'query-my-account', {}));
    if (
      account.availablePoint === undefined ||
      account.availablePoint === null ||
      !Number.isFinite(Number(account.availablePoint))
    )
      throw new BusinessError('未获得有效积分余额');
    if (Number(account.availablePoint) < points) throw new BusinessError('当前积分不足');
    return {
      summary: `${prefix}预约 ${detail.spuName}，${args.partyType === 1 ? '包场' : '拼团'} ${args.count}人；门店 ${args.storeCode}，${args.dateStr} ${args.timeStart}–${args.timeEnd}；按SKU规格×人数估算 ${points} 积分、现金 ¥${(price / 100).toFixed(2)}。场次价格字段：${session.price ?? '未返回'}（接口未说明单位和计价规则），最终收费及人数校验以官方创建订单返回为准。`,
      consumption: {
        type: 'PARTY',
        points,
        price,
        sessionPrice: session.price ?? null,
        priceEstimated: true,
        sessionId: args.id,
      },
    };
  }
  if (name === 'cancel-order') {
    const order = businessData(await callTool(user, 'query-order', { orderId: args.orderId }));
    return {
      summary: `${prefix}取消本人订单 ${order.orderId ?? args.orderId}，原因编码 ${args.cancelReasonCode}。最终能否取消以官方结果为准。`,
    };
  }
  if (name === 'delivery-create-address') {
    if (
      !/^1\d{10}$/.test(args.phone) ||
      !['city', 'address', 'addressDetail', 'contactName'].every(
        (key) => typeof args[key] === 'string' && args[key].trim(),
      )
    )
      throw new BusinessError('请填写有效真实地址、联系人与11位手机号');
    return {
      summary: `${prefix}新增配送地址：${args.city}${args.address}${args.addressDetail}；联系人 ${args.contactName}${args.gender ?? ''}，电话 ${String(args.phone).replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}。`,
    };
  }
  if (name === 'auto-bind-coupons') {
    const available = businessData(await callTool(user, 'available-coupons', {}));
    return {
      summary: `${prefix}领取当前可领优惠券，查询返回 ${Array.isArray(available) ? available.length : '若干'} 项。最终领取数量以官方接口返回为准。`,
    };
  }
  throw new BusinessError('不支持此写操作');
}
function previewRow(row: any) {
  return {
    confirmationId: row.id,
    name: row.name,
    summary: row.summary,
    ...(row.consumption ? { consumption: JSON.parse(row.consumption) } : {}),
    expiresAt: new Date(row.expires_at).toISOString(),
    args: JSON.parse(row.args),
  };
}
export async function previewAction(user: string, name: string, args: Record<string, unknown>) {
  init();
  name = canonicalName(name);
  if (!WRITE_TOOLS.has(name)) throw new BusinessError('这是查询工具，无需交易确认');
  const sessionId = connectionKey(user);
  const copy = JSON.parse(JSON.stringify(args));
  const { summary, consumption } = await validateAction(user, name, copy);
  if (connectionKey(user) !== sessionId)
    throw new BusinessError('账户连接在预览期间已变更，请重新预览');
  const fingerprint = createHash('sha256')
    .update(stable({ session: connectionKey(user), name, args: copy, consumption }))
    .digest('hex');
  const existing = db()
    .prepare(
      "SELECT * FROM mcp_actions WHERE user_id=? AND fingerprint=? AND (state IN ('uncertain','executing') OR created_at>=?) ORDER BY created_at DESC LIMIT 1",
    )
    .get(user, fingerprint, Date.now() - 5 * 60 * 1000) as any;
  if (existing && ['uncertain', 'executing'].includes(existing.state))
    throw new BusinessError('相同操作执行中或结果不确定，请先核实官方结果，不能重复提交');
  // A fresh preview is a new explicit intention for redemption/lottery. Orders keep
  // a short duplicate-cart guard; repeating an existing confirmation is always safe.
  if (
    existing &&
    (existing.state === 'pending' || (name === 'create-order' && existing.state === 'succeeded')) &&
    existing.expires_at > Date.now()
  )
    return previewRow(existing);
  const id = randomUUID(),
    now = Date.now(),
    expires = now + 5 * 60 * 1000;
  db()
    .prepare(
      'INSERT INTO mcp_actions (id,user_id,session_id,name,args,summary,consumption,fingerprint,state,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    )
    .run(
      id,
      user,
      connectionKey(user),
      name,
      JSON.stringify(copy),
      summary,
      consumption ? JSON.stringify(consumption) : null,
      fingerprint,
      'pending',
      now,
      expires,
    );
  return {
    confirmationId: id,
    name,
    summary,
    ...(consumption ? { consumption } : {}),
    expiresAt: new Date(expires).toISOString(),
    args: copy,
  };
}
export async function executeAction(user: string, confirmationId: string): Promise<any> {
  init();
  const row = db()
    .prepare('SELECT * FROM mcp_actions WHERE id=? AND user_id=?')
    .get(confirmationId, user) as any;
  if (!row) throw new BusinessError('确认操作不存在或不属于当前用户');
  if (row.session_id !== connectionKey(user)) throw new BusinessError('账户连接已变更，请重新预览');
  if (row.state === 'succeeded') return JSON.parse(row.result);
  if (row.state !== 'pending') throw new BusinessError(row.error ?? '此操作已提交，不能重复执行');
  if (row.expires_at < Date.now()) throw new BusinessError('确认已过期，请重新预览当前价格和消耗');
  db().exec('BEGIN IMMEDIATE');
  try {
    if (db().prepare('SELECT action_id FROM mcp_action_locks WHERE user_id=?').get(user))
      throw new BusinessError('本账户有操作执行中或待核实，请先查询结果');
    const changed = db()
      .prepare(
        "UPDATE mcp_actions SET state='executing' WHERE id=? AND user_id=? AND state='pending'",
      )
      .run(confirmationId, user);
    if (changed.changes !== 1) throw new BusinessError('该操作已执行，请勿重复提交');
    db().prepare('INSERT INTO mcp_action_locks VALUES (?,?)').run(user, confirmationId);
    db().exec('COMMIT');
  } catch (error) {
    db().exec('ROLLBACK');
    throw error;
  }
  let sent = false;
  try {
    const args = JSON.parse(row.args);
    const current = await validateAction(user, row.name, args);
    if (row.session_id !== connectionKey(user))
      throw new BusinessError('账户连接已变更，请重新预览');
    if (
      stable(current.consumption ?? null) !==
      stable(row.consumption ? JSON.parse(row.consumption) : null)
    )
      throw new BusinessError('价格、积分消耗或场次已变化，请重新预览确认');
    sent = true;
    const result = await invokeConfirmedTool(user, row.name, args);
    db()
      .prepare("UPDATE mcp_actions SET state='succeeded',result=? WHERE id=?")
      .run(JSON.stringify(result), confirmationId);
    db()
      .prepare('DELETE FROM mcp_action_locks WHERE user_id=? AND action_id=?')
      .run(user, confirmationId);
    return result;
  } catch (error) {
    const uncertain =
      error instanceof UncertainWriteError || (sent && !(error instanceof BusinessError));
    const message = error instanceof Error ? error.message : '操作失败';
    db()
      .prepare('UPDATE mcp_actions SET state=?,error=? WHERE id=?')
      .run(uncertain ? 'uncertain' : 'failed', message, confirmationId);
    if (!uncertain)
      db()
        .prepare('DELETE FROM mcp_action_locks WHERE user_id=? AND action_id=?')
        .run(user, confirmationId);
    throw error;
  }
}
export function actionHistory(user: string) {
  init();
  return (
    db()
      .prepare(
        'SELECT id,name,summary,state,error,created_at FROM mcp_actions WHERE user_id=? ORDER BY created_at DESC LIMIT 20',
      )
      .all(user) as any[]
  ).map((r) => ({
    confirmationId: r.id,
    name: r.name,
    summary: r.summary,
    state: r.state,
    error: r.error,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}
