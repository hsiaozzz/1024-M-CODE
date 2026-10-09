import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import Ajv, { type ValidateFunction } from 'ajv';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import { demoCall } from './demo-tools';
import { businessData, parseDataText } from './mcd-normalize';
import { canonicalName, DEMO_TOOL_DEFINITIONS, KNOWN_TOOLS, WRITE_TOOLS } from './tool-catalog';
import type { ToolDefinition } from './types';

type LiveSession = {
  client: Client;
  transport: StreamableHTTPClientTransport;
  tools: ToolDefinition[];
  names: Map<string, string>;
  id: string;
  validators: Map<string, ValidateFunction>;
};
const globals = globalThis as typeof globalThis & {
  mcMcpSessions?: Map<string, LiveSession>;
  mcMcpConnectLocks?: Set<string>;
  mcMcpDemoKeys?: Map<string, string>;
};
const sessions = (globals.mcMcpSessions ??= new Map<string, LiveSession>());
const connectLocks = (globals.mcMcpConnectLocks ??= new Set<string>());
const demoKeys = (globals.mcMcpDemoKeys ??= new Map<string, string>());
const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
const demoValidators = new Map(
  DEMO_TOOL_DEFINITIONS.map((t) => [t.name, ajv.compile(t.inputSchema)]),
);
export class BusinessError extends Error {
  readonly uncertain = false;
}
export class UncertainWriteError extends Error {
  readonly uncertain = true;
}
class UnrecognizedResponseError extends Error {}
function init() {
  db().exec(
    'CREATE TABLE IF NOT EXISTS mcp_observations (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,session_id TEXT NOT NULL,name TEXT NOT NULL,args TEXT NOT NULL,result TEXT NOT NULL,created_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS mcp_observation_user ON mcp_observations(user_id,name,created_at)',
  );
}
export function connectionKey(user: string) {
  if (sessions.has(user)) return sessions.get(user)!.id;
  if (!demoKeys.has(user)) demoKeys.set(user, `demo-${randomUUID()}`);
  return demoKeys.get(user)!;
}
export function connectionStatus(user: string) {
  const session = sessions.get(user);
  return {
    mode: session ? ('live' as const) : ('demo' as const),
    label: session ? '实时麦当劳账户' : 'DEMO · 虚拟积分与订单',
    toolCount: session?.tools.length ?? DEMO_TOOL_DEFINITIONS.length,
  };
}
export async function listTools(user: string): Promise<ToolDefinition[]> {
  return sessions.get(user)?.tools ?? DEMO_TOOL_DEFINITIONS;
}
export async function disconnectUser(user: string) {
  const previous = sessions.get(user);
  sessions.delete(user);
  demoKeys.set(user, `demo-${randomUUID()}`);
  if (previous) await previous.client.close().catch(() => {});
  init();
  db().prepare('DELETE FROM mcp_observations WHERE user_id=?').run(user);
  return connectionStatus(user);
}
export async function connectUser(user: string, token: string) {
  if (
    typeof token !== 'string' ||
    token.trim().length < 8 ||
    token.length > 8192 ||
    /[\r\n]/.test(token)
  )
    throw new BusinessError('请输入你自己的麦当劳 MCP Token');
  if (connectLocks.has(user)) throw new BusinessError('当前账户正在连接，请稍候');
  connectLocks.add(user);
  const client = new Client({ name: 'mcmissions', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL('https://mcp.mcd.cn'), {
    requestInit: { headers: { Authorization: `Bearer ${token.trim()}` } },
  });
  try {
    await client.connect(transport, { timeout: 25000 });
    const remote = [];
    let cursor: string | undefined;
    do {
      const response = await client.listTools(cursor ? { cursor } : undefined, { timeout: 25000 });
      remote.push(...response.tools);
      cursor = response.nextCursor;
    } while (cursor && remote.length < 100);
    const tools: ToolDefinition[] = remote
      .filter((t) => KNOWN_TOOLS.has(canonicalName(t.name)))
      .map((t) => {
        const base = DEMO_TOOL_DEFINITIONS.find((d) => d.name === canonicalName(t.name))!;
        return {
          ...base,
          description: t.description ?? base.description,
          inputSchema: t.inputSchema as Record<string, unknown>,
        };
      });
    if (!tools.length) throw new BusinessError('连接成功但服务器未返回受支持的麦当劳工具');
    const previous = sessions.get(user);
    const session = {
      client,
      transport,
      tools,
      names: new Map(remote.map((t) => [canonicalName(t.name), t.name])),
      id: randomUUID(),
      validators: new Map(tools.map((t) => [t.name, ajv.compile(t.inputSchema)])),
    };
    sessions.set(user, session);
    if (previous) await previous.client.close().catch(() => {});
    init();
    db().prepare('DELETE FROM mcp_observations WHERE user_id=?').run(user);
    return connectionStatus(user);
  } catch (error) {
    await client.close().catch(() => {});
    if (error instanceof BusinessError) throw error;
    throw new BusinessError('MCP 连接失败，请检查 Token 与网络后重试');
  } finally {
    connectLocks.delete(user);
  }
}
export async function validateToolArgs(user: string, name: string, args: unknown) {
  name = canonicalName(name);
  const validator =
    sessions.get(user)?.validators.get(name) ??
    (!sessions.has(user) ? demoValidators.get(name) : undefined);
  if (!validator) throw new BusinessError('当前连接不支持这个工具');
  if (!args || typeof args !== 'object' || Array.isArray(args))
    throw new BusinessError('工具参数必须是对象');
  assertSafeData(args);
  if (!validator(args))
    throw new BusinessError(
      `参数不符合工具要求：${ajv.errorsText(validator.errors, { separator: '；' })}`,
    );
}
/** JSON arguments must never contain object-prototype paths, even with permissive remote schemas. */
export function assertSafeData(value: unknown, depth = 0, budget = { nodes: 0 }): void {
  if (depth > 20 || ++budget.nodes > 10000) throw new BusinessError('参数嵌套过深或过大');
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    value === undefined
  )
    return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new BusinessError('参数数字无效');
    return;
  }
  if (typeof value !== 'object') throw new BusinessError('参数包含不支持的值');
  for (const key of Object.keys(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key))
      throw new BusinessError('参数包含禁止的对象原型字段');
    assertSafeData((value as Record<string, unknown>)[key], depth + 1, budget);
  }
}
export function observeRead(user: string, name: string, args: any, result: any) {
  init();
  db()
    .prepare('INSERT INTO mcp_observations VALUES (?,?,?,?,?,?,?)')
    .run(
      randomUUID(),
      user,
      connectionKey(user),
      canonicalName(name),
      JSON.stringify(args),
      JSON.stringify(result),
      Date.now(),
    );
  db()
    .prepare('DELETE FROM mcp_observations WHERE user_id=? AND created_at<?')
    .run(user, Date.now() - 24 * 60 * 60 * 1000);
}
export function observations(
  user: string,
  name: string,
  maxAge = 10 * 60 * 1000,
): { args: any; result: any; createdAt: number }[] {
  init();
  return (
    db()
      .prepare(
        'SELECT args,result,created_at FROM mcp_observations WHERE user_id=? AND session_id=? AND name=? AND created_at>=? ORDER BY created_at DESC LIMIT 100',
      )
      .all(user, connectionKey(user), canonicalName(name), Date.now() - maxAge) as any[]
  ).map((row) => ({
    args: JSON.parse(row.args),
    result: JSON.parse(row.result),
    createdAt: row.created_at,
  }));
}
export function requireObservation(
  user: string,
  name: string,
  match: (o: { args: any; result: any; createdAt: number }) => boolean,
  message: string,
) {
  const o = observations(user, name).find(match);
  if (!o) throw new BusinessError(message);
  return o;
}
const rows = (raw: any): any[] => {
  const data = businessData(raw);
  return Array.isArray(data) ? data : (data?.addresses ?? data?.list ?? data?.stores ?? []);
};
export function channelArgs(args: any) {
  const { beType, orderType, beCode } = args;
  if (![1, 2, 5, 6].includes(beType)) throw new BusinessError('请选择明确的取餐业务类型');
  if (orderType !== ([1, 5].includes(beType) ? 1 : 2))
    throw new BusinessError('orderType 与取餐方式不匹配');
  if (beType === 1 && beCode !== undefined && beCode !== '')
    throw new BusinessError('到店自取不应传 beCode');
  if (beType !== 1 && !beCode) throw new BusinessError('该渠道需要从门店结果选择 beCode');
}
export const sameChannel = (a: any, b: any) =>
  a.storeCode === b.storeCode &&
  a.beType === b.beType &&
  a.orderType === b.orderType &&
  (a.beCode ?? '') === (b.beCode ?? '') &&
  (a.reservationDate ?? '') === (b.reservationDate ?? '');
function storeContext(user: string, args: any) {
  channelArgs(args);
  const tool = [1, 5].includes(args.beType) ? 'query-nearby-stores' : 'delivery-query-stores';
  const found = requireObservation(
    user,
    tool,
    (o) =>
      o.args.beType === args.beType &&
      rows(o.result).some(
        (s) =>
          String(s.storeCode ?? s.code) === args.storeCode &&
          (s.beCode ?? '') === (args.beCode ?? ''),
      ),
    '请先查询并选择当前渠道的真实门店',
  );
  const selected = rows(found.result).find(
    (s) =>
      String(s.storeCode ?? s.code) === args.storeCode && (s.beCode ?? '') === (args.beCode ?? ''),
  );
  if (selected?.businessStatus === false || selected?.businessStatus === 0)
    throw new BusinessError('这家门店当前暂停营业');
  if (args.reservationDate) {
    if (
      !/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d$/.test(args.reservationDate) ||
      !selected?.reservation ||
      !selected.reservationTimeOptions?.some(
        (d: any) => d.date === args.reservationDate.slice(0, 10),
      )
    )
      throw new BusinessError(
        '请选择门店返回的可预约日期并使用 yyyy-MM-dd HH:mm 格式；具体时段由官方实时校验',
      );
  }
}
function readDependencies(user: string, name: string, args: any) {
  if (name === 'query-nearby-stores' && args.searchType === 2 && (!args.city || !args.keyword))
    throw new BusinessError('位置搜索需要城市与地址关键词');
  if (name === 'delivery-query-stores')
    requireObservation(
      user,
      'delivery-query-addresses',
      (o) => rows(o.result).some((a) => String(a.addressId) === args.addressId),
      '请先打开地址簿并选择配送地址',
    );
  if (
    [
      'query-meals',
      'query-meal-detail',
      'query-store-coupons',
      'calculate-price',
      'query-promotions',
      'query-meal-assistance',
    ].includes(name)
  )
    storeContext(user, args);
  if (['query-promotions', 'query-meal-assistance'].includes(name) && args.beType !== 6)
    throw new BusinessError('此能力只用于企业团餐');
  if (name === 'query-meal-detail')
    requireObservation(
      user,
      'query-meals',
      (o) =>
        sameChannel(o.args, args) && Object.hasOwn(businessData(o.result)?.meals ?? {}, args.code),
      '请先查询菜单并选择餐品',
    );
  if (name === 'calculate-price') validateCartContext(user, args);
  if (name === 'mall-product-detail')
    requireObservation(
      user,
      'mall-points-products',
      (o) => rows(o.result).some((p) => p.spuId === args.spuId),
      '请先查询商城并选择商品',
    );
  if (name.startsWith('query-party-')) {
    requireObservation(
      user,
      'mall-product-detail',
      (o) => businessData(o.result)?.spuId === args.spuId && businessData(o.result)?.shopId === 5,
      '请先选择官方活动商品及其规格',
    );
    if (name === 'query-party-store')
      requireObservation(
        user,
        'query-party-city',
        (o) =>
          o.args.spuId === args.spuId &&
          rows(o.result).some(
            (c) =>
              String(c.code) === args.code &&
              (args.latitude === undefined || c.latitude === args.latitude) &&
              (args.longitude === undefined || c.longitude === args.longitude),
          ),
        '请先查询活动城市并明确选择城市',
      );
    if (name === 'query-party-store-date')
      requireObservation(
        user,
        'query-party-store',
        (o) =>
          o.args.spuId === args.spuId &&
          rows(o.result).some((s) => String(s.code ?? s.storeCode) === args.storeCode),
        '请先查询活动门店并明确选择门店',
      );
    if (name === 'query-party-store-session')
      requireObservation(
        user,
        'query-party-store-date',
        (o) =>
          o.args.spuId === args.spuId &&
          o.args.storeCode === args.storeCode &&
          rows(o.result).some((d) => d.date === args.dateStr),
        '请先查询活动日期并明确选择日期',
      );
  }
}
function validateModification(values: any, definition: any) {
  const groups = definition?.items ?? [];
  if (!groups.length && values?.length) throw new BusinessError('该商品未提供这些特调选项');
  for (const v of values ?? [])
    if (
      !groups.some((g: any) =>
        g.values?.some(
          (d: any) => d.code === v.code && (d.selectedKey === v.key || d.unselectedKey === v.key),
        ),
      )
    )
      throw new BusinessError('特调 code/key 必须来自餐品详情');
  for (const g of groups) {
    let selected = 0;
    for (const d of g.values ?? []) {
      const matches = (values ?? []).filter((v: any) => v.code === d.code);
      if (matches.length > 1) throw new BusinessError('特调选项重复');
      const v = matches[0];
      if (d.unselectedKey && !v)
        throw new BusinessError('该组每个特调都需传 selectedKey 或 unselectedKey');
      if (v?.key === d.selectedKey) {
        selected += v.quantity;
        if (v.quantity < (d.minQuantity ?? 0) || v.quantity > (d.maxQuantity ?? 100))
          throw new BusinessError('特调数量不符合餐品规则');
      } else if (v && v.quantity !== 0) throw new BusinessError('未选中特调数量应为0');
    }
    if (selected < (g.minValues ?? 0) || selected > (g.maxValues ?? 100))
      throw new BusinessError('特调选择数量不符合规则');
  }
}
export function validateCartContext(user: string, args: any) {
  const menu = requireObservation(
    user,
    'query-meals',
    (o) => sameChannel(o.args, args),
    '请先获取当前门店、渠道与预约时间的菜单',
  );
  if (!Array.isArray(args.items) || !args.items.length) throw new BusinessError('购物车不能为空');
  for (const item of args.items) {
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 100 ||
      !Object.hasOwn(businessData(menu.result)?.meals ?? {}, item.productCode)
    )
      throw new BusinessError('商品和数量必须来自当前菜单，单项数量最多100');
    if (item.couponId || item.couponCode)
      requireObservation(
        user,
        'query-store-coupons',
        (o) =>
          sameChannel(o.args, args) &&
          rows(o.result).some(
            (c) =>
              c.couponId === item.couponId &&
              c.couponCode === item.couponCode &&
              c.products?.some((p: any) => p.productCode === item.productCode),
          ),
        '请先查询当前门店可用券并选择对应商品',
      );
    if (item.modification || item.roundList) {
      const detail = businessData(
        requireObservation(
          user,
          'query-meal-detail',
          (o) => sameChannel(o.args, args) && o.args.code === item.productCode,
          '请先查看商品详情再修改套餐或特调',
        ).result,
      );
      if (item.modification) validateModification(item.modification.values, detail.modification);
      if (item.roundList) {
        for (const required of detail.rounds ?? [])
          if (
            (required.minQuantity ?? 0) > 0 &&
            !item.roundList.some((r: any) => String(r.round) === String(required.id))
          )
            throw new BusinessError('套餐缺少必选轮次');
        const seen = new Set<string>();
        for (const round of item.roundList) {
          if (seen.has(String(round.round))) throw new BusinessError('套餐轮次不能重复');
          seen.add(String(round.round));
          const r = detail.rounds?.find((r: any) => String(r.id) === String(round.round));
          if (!r) throw new BusinessError('套餐轮次必须来自商品详情');
          let count = 0;
          for (const choice of round.comboItemList ?? []) {
            const d = r.choices?.find((d: any) => d.code === choice.code);
            if (!d) throw new BusinessError('套餐子项必须来自对应轮次');
            if (
              !Number.isInteger(choice.quantity) ||
              choice.quantity < 1 ||
              choice.quantity > (d.maxQuantity ?? 100)
            )
              throw new BusinessError('套餐子项数量不符合规则');
            count += choice.quantity;
            if (choice.modification)
              validateModification(choice.modification.values, d.modification);
          }
          if (count < (r.minQuantity ?? 0) || count > (r.maxQuantity ?? 100))
            throw new BusinessError('套餐轮次数量不符合规则');
        }
      }
    }
  }
  if (args.beType === 6)
    requireObservation(
      user,
      'query-meal-assistance',
      (o) =>
        sameChannel(o.args, args) &&
        businessData(o.result)?.mealAssistanceItems?.some(
          (s: any) => s.enable && s.gmServiceCode === args.gmServiceCode,
        ),
      '团餐试算前需选择当前可用助餐服务',
    );
  if (args.withOrder)
    requireObservation(
      user,
      'query-meals',
      (o) =>
        sameChannel(o.args, args) &&
        Object.values(businessData(o.result)?.meals ?? {}).some(
          (m: any) =>
            m.withOrder &&
            m.withOrder.cardId === args.withOrder.cardId &&
            m.withOrder.membershipCode === args.withOrder.membershipCode &&
            (m.withOrder.specId ?? m.withOrder.membershipSpecId) ===
              args.withOrder.membershipSpecId,
        ),
      '随单购标识必须来自当前菜单',
    );
}
export function unwrapMcpResult(result: any): any {
  if (result?.isError)
    throw new UnrecognizedResponseError('MCP 工具返回错误，未提供可核实的业务结果');
  let raw = result?.structuredContent;
  if (raw === undefined) {
    const texts = (result?.content ?? [])
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text);
    for (const text of texts) {
      const parsed = parseDataText(text);
      if (parsed && typeof parsed === 'object') {
        raw = parsed;
        break;
      }
    }
  }
  if (raw === undefined) throw new UnrecognizedResponseError('无法解析 MCP 响应数据');
  if (
    raw.success === false ||
    (raw.code !== undefined && ![200, 0, '200', '0', 'SUCCESS'].includes(raw.code))
  )
    throw new BusinessError(String(raw.message ?? '麦当劳业务请求失败'));
  const status = raw.data?.status;
  if (status && typeof status === 'object' && status.code && status.code !== 'SUCCESS')
    throw new BusinessError(String(status.message ?? '业务请求失败'));
  if (raw.data?.status === 0 || raw.data?.cancelResult === false)
    throw new BusinessError(String(raw.message ?? '业务操作未完成'));
  return raw;
}
function requireMutationResult(name: string, result: any) {
  const d = businessData(result);
  let known = false;
  if (name === 'create-order') known = Boolean(d?.orderId || d?.orderDetail?.orderId);
  if (name === 'mall-create-order' || name === 'party-order-create')
    known = Boolean(d?.orderId) && [1, 2].includes(d?.status);
  if (name === 'draw-lottery') known = d?.status?.code === 'SUCCESS' && typeof d?.win === 'boolean';
  if (name === 'cancel-order') known = d?.cancelResult === true;
  if (name === 'delivery-create-address') known = Boolean(d?.addressId);
  if (name === 'auto-bind-coupons')
    known = typeof d?.successCount === 'number' && typeof d?.failedCount === 'number';
  if (!known)
    throw new UncertainWriteError(
      '官方写操作响应缺少明确结果，请查询订单、积分或奖品核实；系统不会自动重试',
    );
}
async function invoke(user: string, name: string, args: any, mutation: boolean) {
  const requestSessionKey = connectionKey(user);
  name = canonicalName(name);
  await validateToolArgs(user, name, args);
  if (connectionKey(user) !== requestSessionKey)
    throw new BusinessError('账户连接已变更，请重新查询或预览');
  if (WRITE_TOOLS.has(name) !== mutation)
    throw new BusinessError(mutation ? '该工具是查询工具' : '写操作必须先预览并确认');
  if (!mutation) readDependencies(user, name, args);
  const session = sessions.get(user);
  let result: any;
  if (session) {
    try {
      result = unwrapMcpResult(
        await session.client.callTool(
          { name: session.names.get(name)!, arguments: args },
          undefined,
          { timeout: 25000 },
        ),
      );
    } catch (error) {
      if (error instanceof BusinessError) throw error;
      if (mutation)
        throw new UncertainWriteError(
          '请求结果不确定：请查询官方订单、积分或奖品后核实，系统不会自动重复执行',
        );
      throw new BusinessError('MCP 查询失败，请检查网络后重试');
    }
    result = { ...result, _source: 'live' };
  } else {
    try {
      result = unwrapMcpResult({ structuredContent: demoCall(user, name, args) });
    } catch (error) {
      if (error instanceof BusinessError) throw error;
      throw new BusinessError(error instanceof Error ? error.message : '演示工具操作失败');
    }
  }
  if (connectionKey(user) !== requestSessionKey) {
    if (mutation)
      throw new UncertainWriteError(
        '请求期间账户连接已变更，原账户操作结果待核实；系统不会自动重复执行',
      );
    throw new BusinessError('账户连接已变更，请重新查询');
  }
  if (mutation) requireMutationResult(name, result);
  else observeRead(user, name, args, result);
  return result;
}
export const callTool = (user: string, name: string, args: Record<string, unknown> = {}) =>
  invoke(user, name, args, false);
/** Internal transaction gateway. HTTP clients must use executeAction. */
export const invokeConfirmedTool = (user: string, name: string, args: Record<string, unknown>) =>
  invoke(user, name, args, true);
