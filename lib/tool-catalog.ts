import type { ToolDefinition } from './types';

export const canonicalName = (name: string) =>
  name.replace(/^mcp__mcd_mcp__/, '').replaceAll('_', '-');
export const WRITE_TOOLS = new Set([
  'auto-bind-coupons',
  'delivery-create-address',
  'create-order',
  'cancel-order',
  'mall-create-order',
  'party-order-create',
  'draw-lottery',
]);
const s = (description: string, extra = {}) => ({ type: 'string', description, ...extra });
const n = (description: string, extra = {}) => ({ type: 'integer', description, ...extra });
const obj = (properties: Record<string, unknown> = {}, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const arr = (items: unknown, extra = {}) => ({ type: 'array', items, ...extra });
const modification = obj({
  values: arr(
    obj(
      {
        code: s('特调 code'),
        key: s('selectedKey 或 unselectedKey'),
        quantity: n('特调数量', { minimum: 0 }),
      },
      ['code', 'key', 'quantity'],
    ),
  ),
});
const combo = obj({ code: s('套餐子项 code'), quantity: n('数量', { minimum: 1 }), modification }, [
  'code',
  'quantity',
]);
const item = obj(
  {
    productCode: s('菜单商品 code'),
    quantity: n('数量', { minimum: 1, maximum: 100 }),
    couponId: s('优惠券 ID'),
    couponCode: s('优惠券 code'),
    modification,
    roundList: arr(
      obj({ round: s('轮次 ID'), comboItemList: arr(combo) }, ['round', 'comboItemList']),
    ),
  },
  ['productCode', 'quantity'],
);
const store = {
  storeCode: s('从门店查询结果选择的门店编码', { pattern: '^\\d+$' }),
  beCode: s('得来速/外送/团餐业务编码'),
  beType: n('1自取 2外送 5得来速 6团餐', { enum: [1, 2, 5, 6] }),
  orderType: n('1到店 2外送', { enum: [1, 2] }),
  reservationDate: s('预约时间 yyyy-MM-dd HH:mm'),
};
const storeRequired = ['storeCode', 'beType', 'orderType'];
const cart = {
  ...store,
  items: arr(item, { minItems: 1 }),
  gmServiceCode: s('团餐助餐服务编码'),
  needTableware: { type: 'boolean', description: '是否需要餐具' },
  withOrder: obj({
    cardId: s('随单购卡ID'),
    cardType: n('随单购卡类型'),
    membershipCode: s('会员 code'),
    membershipSpecId: s('规格 ID'),
  }),
};
const defs: [string, string, string, Record<string, unknown>, string[]?][] = [
  [
    'query-nearby-stores',
    '附近门店',
    '城市探索',
    {
      beType: n('取餐方式', { enum: [1, 5] }),
      searchType: n('1收藏餐厅 2位置搜索', { enum: [1, 2] }),
      city: s('城市'),
      keyword: s('地址或地点'),
    },
    ['beType', 'searchType'],
  ],
  ['delivery-query-addresses', '配送地址簿', '配送', {}],
  [
    'delivery-create-address',
    '创建配送地址',
    '配送',
    {
      city: s('城市'),
      contactName: s('真实联系人'),
      gender: s('称呼'),
      phone: s('11位手机号', { pattern: '^1\\d{10}$' }),
      address: s('配送地址'),
      addressDetail: s('门牌号'),
    },
    ['city', 'contactName', 'phone', 'address', 'addressDetail'],
  ],
  [
    'delivery-query-stores',
    '可配送餐厅',
    '配送',
    { addressId: s('地址ID'), beType: n('2麦乐送 6企业团餐', { enum: [2, 6] }) },
    ['addressId', 'beType'],
  ],
  ['campaign-calendar', '官方活动日历', '活动', { specifiedDate: s('yyyy-MM-dd') }],
  ['now-time-info', '当前服务时间', '活动', {}],
  ['query-meals', '实时门店菜单', '餐品实验室', store, storeRequired],
  [
    'query-meal-detail',
    '套餐组成与特调',
    '餐品实验室',
    { ...store, code: s('餐品 code') },
    [...storeRequired, 'code'],
  ],
  ['list-nutrition-foods', '营养数据', '餐品实验室', {}],
  ['available-coupons', '可领取的优惠券', '优惠', {}],
  ['auto-bind-coupons', '一键领取可领优惠券', '优惠', {}],
  [
    'query-my-coupons',
    '我的卡包（未验证门店适用性）',
    '优惠',
    { page: s('页码 1-5'), pageSize: s('每页最多200') },
  ],
  ['query-store-coupons', '当前门店和渠道可用券', '优惠', store, storeRequired],
  [
    'query-promotions',
    '企业团餐满减满折',
    '团餐',
    { ...store, beType: n('固定6', { const: 6 }), orderType: n('固定2', { const: 2 }) },
    storeRequired,
  ],
  ['calculate-price', '官方试算（金额单位分）', '餐品实验室', cart, [...storeRequired, 'items']],
  ['query-my-account', '积分及到期积分', '积分藏宝阁', {}],
  [
    'mall-points-products',
    '积分商城商品和活动',
    '积分藏宝阁',
    { catRuleIds: s('1>4商品券 2实物 1>6>21主题派对，逗号分隔') },
  ],
  [
    'mall-product-detail',
    '商品规格与原文购买须知',
    '积分藏宝阁',
    { spuId: n('已选商品SPU') },
    ['spuId'],
  ],
  [
    'mall-create-order',
    '兑换商品（真实积分/现金）',
    '积分藏宝阁',
    {
      skuId: n('已选规格SKU'),
      spuCategory: s('1虚拟 2实物', { enum: ['1', '2'] }),
      count: n('兑换数量', { minimum: 1, maximum: 100 }),
      addressId: s('实物收货地址ID'),
    },
    ['skuId', 'spuCategory'],
  ],
  [
    'mall-order-list',
    '商城与活动订单',
    '订单旅程',
    { lastId: n('上一页最后订单ID'), size: n('数量最多10', { minimum: 1, maximum: 10 }) },
  ],
  ['mall-order-detail', '商城订单详情', '订单旅程', { orderId: s('真实商城订单ID') }, ['orderId']],
  ['query-party-city', '活动支持城市', '官方活动副本', { spuId: n('已选活动SPU') }, ['spuId']],
  [
    'query-party-store',
    '活动城市门店',
    '官方活动副本',
    {
      code: s('已选城市code'),
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      spuId: n('活动SPU'),
    },
    ['code', 'spuId'],
  ],
  [
    'query-party-store-date',
    '活动门店可预约日期',
    '官方活动副本',
    { spuId: n('活动SPU'), storeCode: s('已选活动门店code') },
    ['spuId', 'storeCode'],
  ],
  [
    'query-party-store-session',
    '活动日期场次',
    '官方活动副本',
    { spuId: n('活动SPU'), storeCode: s('已选门店code'), dateStr: s('已选日期') },
    ['spuId', 'storeCode', 'dateStr'],
  ],
  [
    'party-order-create',
    '创建活动预约（逐步选择）',
    '官方活动副本',
    {
      spuId: n('活动SPU'),
      skuId: n('规格SKU'),
      partyType: n('1包场 2拼团', { enum: [1, 2] }),
      code: s('城市code'),
      storeCode: s('门店code'),
      dateStr: s('日期'),
      id: n('场次ID'),
      timeStart: s('场次开始时间'),
      timeEnd: s('场次结束时间'),
      leftNum: n('实时余位'),
      count: n('参加人数', { minimum: 1 }),
      partyTimeInfo: obj({
        id: n('场次ID'),
        leftNum: n('余位'),
        partyMax: n('上限'),
        partyMin: n('下限'),
        price: { type: 'number' },
        timeStart: s('开始'),
        timeEnd: s('结束'),
      }),
    },
    [
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
    ],
  ],
  ['query-lottery-info', '抽奖资格与本次真实消耗', '幸运站', {}],
  ['draw-lottery', '确认消耗后抽奖一次', '幸运站', {}],
  [
    'query-my-prizes',
    '本期和历史抽奖战利品',
    '幸运站',
    { pageNum: n('页码', { minimum: 1 }), pageSize: n('每页数量', { minimum: 1, maximum: 50 }) },
  ],
  [
    'query-meal-assistance',
    '企业团餐助餐服务',
    '团餐',
    { ...store, beType: n('固定6', { const: 6 }), orderType: n('固定2', { const: 2 }) },
    storeRequired,
  ],
  [
    'create-order',
    '创建餐饮订单，支付在官方页面完成',
    '订单旅程',
    {
      ...cart,
      addressId: s('外送/团餐地址ID'),
      takeWayCode: s('本次试算返回的取餐方式code'),
      remark: s('配送备注（最多50字）', { maxLength: 50 }),
    },
    [...storeRequired, 'items'],
  ],
  ['order-list', '历史餐饮订单', '订单旅程', {}],
  [
    'query-order',
    '订单支付、配餐和取餐状态',
    '订单旅程',
    { orderId: s('真实餐饮订单ID') },
    ['orderId'],
  ],
  [
    'cancel-order',
    '取消餐饮订单',
    '订单旅程',
    {
      orderId: s('订单ID'),
      cancelReasonCode: s('1改主意 2重复 3点错 4地址电话 5时间 -1其他', {
        enum: ['1', '2', '3', '4', '5', '-1'],
      }),
    },
    ['orderId', 'cancelReasonCode'],
  ],
  [
    'query-survey-coupon',
    '本人已有满意度答卷和奖券',
    '订单旅程',
    { orderId: s('本人真实订单号', { pattern: '^[A-Za-z0-9_-]{1,64}$' }) },
    ['orderId'],
  ],
];
export const DEMO_TOOL_DEFINITIONS: ToolDefinition[] = defs.map(
  ([name, description, scene, properties, required]) => ({
    name,
    description,
    scene,
    write: WRITE_TOOLS.has(name),
    inputSchema: obj(properties, required),
  }),
);
export const KNOWN_TOOLS = new Set(DEMO_TOOL_DEFINITIONS.map((t) => t.name));
