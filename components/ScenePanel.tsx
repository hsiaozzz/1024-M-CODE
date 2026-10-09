'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import type { CartItem, Mode, Profile, Store, ToolDefinition } from '@/lib/types';
import { Modal } from './Modal';
import { MealCustomizer } from './MealCustomizer';
import { TeamRoom } from './TeamRoom';

type Obj = Record<string, unknown>;
type Schema = {
  type?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  description?: string;
  minimum?: number;
  maximum?: number;
  anyOf?: Schema[];
  oneOf?: Schema[];
};
export type SceneId =
  'coupons' | 'points' | 'lottery' | 'party' | 'orders' | 'delivery' | 'team' | 'lab' | 'events';
export const scenes: Record<
  SceneId,
  { title: string; description: string; icon: string; actions: [string, string][] }
> = {
  coupons: {
    title: '特工券包',
    description: '发现可领优惠，再看看哪张券适合你的补给。',
    icon: '🎟️',
    actions: [
      ['available-coupons', '发现可领取的券'],
      ['auto-bind-coupons', '领取当前可领优惠'],
      ['query-my-coupons', '打开我的券包'],
      ['query-store-coupons', '查看门店适用券'],
    ],
  },
  points: {
    title: '积分收藏室',
    description: '看看积分余额，挑一件真正喜欢的餐品券或周边。',
    icon: '🎁',
    actions: [
      ['query-my-account', '查看积分和有效期'],
      ['mall-points-products', '发现可兑换的收藏'],
      ['mall-product-detail', '选择商品规格'],
      ['mall-create-order', '兑换选中的商品'],
      ['mall-order-list', '我的商城订单'],
      ['mall-order-detail', '查看兑换详情'],
    ],
  },
  lottery: {
    title: '幸运补给站',
    description: '先了解本次消耗，再亲自决定是否参加。',
    icon: '🎡',
    actions: [
      ['query-lottery-info', '查看活动和本次消耗'],
      ['draw-lottery', '参加一次抽奖'],
      ['query-my-prizes', '我的中奖收藏'],
    ],
  },
  party: {
    title: '城市活动局',
    description: '从一个感兴趣的活动开始，逐步找到城市和场次。',
    icon: '🎈',
    actions: [
      ['mall-points-products', '发现主题活动'],
      ['mall-product-detail', '查看活动并选择规格'],
      ['query-party-city', '选择参与城市'],
      ['query-party-store', '选择活动门店'],
      ['query-party-store-date', '选择预约日期'],
      ['query-party-store-session', '选择具体场次'],
      ['party-order-create', '确认参加活动'],
    ],
  },
  orders: {
    title: '补给旅程',
    description: '从一笔订单出发，查看进度、取餐信息和已有答卷奖券。',
    icon: '🛵',
    actions: [
      ['order-list', '我的餐饮订单'],
      ['query-order', '查看进度和取餐码'],
      ['cancel-order', '取消选中的订单'],
      ['query-survey-coupon', '查询已有答卷与奖券'],
    ],
  },
  delivery: {
    title: '配送基地',
    description: '选择地址和配送门店，也可以探索得来速补给。',
    icon: '📍',
    actions: [
      ['delivery-query-addresses', '选择我的配送地址'],
      ['delivery-create-address', '添加配送地址'],
      ['delivery-query-stores', '查找可配送门店'],
      ['query-nearby-stores', '查找自取或得来速门店'],
      ['query-meals', '查看所选门店餐品'],
      ['calculate-price', '核算补给费用'],
      ['create-order', '创建选定补给订单'],
    ],
  },
  team: {
    title: '小队补给',
    description: '为多人安排团餐，用真实促销和助餐服务准备补给。',
    icon: '🤝',
    actions: [
      ['delivery-query-addresses', '选择小队配送地址'],
      ['delivery-query-stores', '选择团餐门店'],
      ['query-meals', '挑选小队餐品'],
      ['query-promotions', '查看团餐满减满折'],
      ['query-meal-assistance', '选择助餐服务'],
      ['calculate-price', '核算小队账单'],
      ['create-order', '创建团餐补给订单'],
    ],
  },
  lab: {
    title: '餐品实验室',
    description: '探索餐品、套餐选择和营养数据，试试不同组合。',
    icon: '🍔',
    actions: [
      ['query-nearby-stores', '选择补给门店'],
      ['query-meals', '探索当季菜单'],
      ['query-meal-detail', '查看套餐与特调'],
      ['list-nutrition-foods', '阅读餐品营养数据'],
      ['calculate-price', '验证你的餐品组合'],
    ],
  },
  events: {
    title: '城市情报台',
    description: '跟着当月活动日历，发现下一次冒险。',
    icon: '🗓️',
    actions: [
      ['campaign-calendar', '查看活动日历'],
      ['now-time-info', '查看活动服务时间'],
    ],
  },
};

const labels: Record<string, string> = {
  city: '城市',
  keyword: '出发位置',
  searchType: '查找方式',
  beType: '补给渠道',
  orderType: '订单类型',
  storeCode: '门店编号',
  beCode: '门店业务编号',
  addressId: '已选配送地址',
  spuId: '已选商品',
  skuId: '已选规格',
  spuCategory: '商品类型',
  count: '数量 / 参与人数',
  code: '已选城市 / 餐品编号',
  latitude: '纬度',
  longitude: '经度',
  dateStr: '预约日期',
  id: '场次编号',
  timeStart: '场次开始',
  timeEnd: '场次结束',
  leftNum: '剩余名额',
  partyType: '参与方式',
  reservationDate: '预约时间',
  gmServiceCode: '助餐服务',
  items: '补给餐品',
  productCode: '餐品编号',
  quantity: '数量',
  couponId: '优惠券编号',
  couponCode: '优惠券码',
  roundList: '套餐子项',
  round: '选配轮次',
  comboItemList: '套餐内餐品',
  modification: '特调选择',
  values: '特调项目',
  key: '特调选项编码',
  needTableware: '需要餐具',
  takeWayCode: '取餐方式编号',
  remark: '配送备注',
  orderId: '选中的订单',
  cancelReasonCode: '取消原因',
  catRuleIds: '收藏 / 活动类型',
  specifiedDate: '日历日期',
  pageNum: '页码',
  pageSize: '每页数量',
  size: '查询数量',
  lastId: '上一页末尾编号',
  phone: '联系电话',
  contactName: '收件人',
  gender: '称呼',
  address: '配送地址',
  addressDetail: '楼栋 / 门牌号',
  withOrder: '随单购',
  cardId: '随单购卡号',
  cardType: '卡类型',
  membershipCode: '随单购会员编号',
  membershipSpecId: '随单购规格',
  availablePoint: '可用积分',
  currentMouthExpirePoint: '本月将过期积分',
  nextMouthExpirePoint: '下月将过期积分',
  usedPoint: '已使用积分',
  expiredPoint: '已过期积分',
  accumulativePoint: '累计积分',
  frozenPoint: '冻结积分',
  accountId: '积分账户',
  currency: '账户类型',
  title: '名称',
  name: '名称',
  spuName: '商品名称',
  productName: '餐品名称',
  storeName: '门店名称',
  gmServiceName: '助餐服务名称',
  points: '所需积分',
  point: '所需积分',
  price: '价格',
  realTotalAmount: '实付金额',
  totalAmount: '总金额',
  originalPrice: '原价',
  discount: '优惠',
  note: '购买须知',
  detail: '详情',
  selling: '商品特色',
  extTradePrice: '核销时另付金额',
  partyPeople: '参与人数说明',
  partyAge: '参与年龄说明',
  partyRange: '活动时长',
  shopId: '商城渠道',
  orderStatus: '订单状态',
  orderStatusTitle: '订单状态',
  orderStatusText: '订单状态',
  status: '状态',
  statusText: '状态说明',
  orderProductList: '订单餐品',
  productList: '餐品明细',
  takeWayList: '取餐方式',
  takeWay: '取餐方式',
  pickupCode: '取餐码',
  lockerCode: '取餐柜密码',
  createTime: '创建时间',
  expirePayTime: '支付截止时间',
  deliveryInfo: '配送信息',
  deliveryAddress: '配送地址',
  expectDeliveryTime: '预计送达',
  customerNickname: '联系人',
  mobilePhone: '联系电话',
  riderNickName: '配送员',
  riderMobilePhone: '配送员电话',
  productPrice: '餐品费用',
  deliveryPrice: '配送费',
  realDeliveryPrice: '实付配送费',
  packingPrice: '打包费',
  realPackingFeeTotalPrice: '打包费',
  tablewarePrice: '餐具费',
  realTotalPrice: '实际总额',
  totalDiscountAmount: '优惠合计',
  couponName: '券名称',
  tradeDateTime: '可用时间',
  tradeStartDate: '可用起始日',
  tradeEndDate: '可用结束日',
  couponStatus: '券状态',
  label: '状态提示',
  activityName: '活动名称',
  activityStatusText: '活动状态',
  beginTime: '开始时间',
  endTime: '结束时间',
  drawPoint: '单次所需积分',
  drawTypeText: '消耗规则',
  availableTimes: '剩余次数',
  drawDecision: '本次参与判断',
  resourceEligible: '资源是否足够',
  nextConsumption: '本次实际消耗',
  fallbackConsumption: '次数用完后的消耗',
  type: '类型',
  amount: '消耗数量',
  win: '是否中奖',
  prizes: '奖品',
  prizeType: '奖品类型',
  typeText: '奖品类型',
  validDateInfo: '有效期',
  timeRemindText: '到期提示',
  recordTime: '获得时间',
  couponList: '使用的优惠券',
  coupons: '兑换到的券',
  successCount: '领取成功',
  failedCount: '领取失败',
  successCoupons: '已领优惠',
  failedCoupons: '未领优惠',
  reason: '原因',
  serviceItems: '服务内容',
  unusableReason: '不可用原因',
  enable: '可用',
  businessStatus: '营业状态',
  businessStartTime: '营业开始',
  businessEndTime: '营业结束',
  distance: '参考距离（米）',
  reservation: '支持预约',
  reservationTimeOptions: '可预约时段',
  date: '日期',
  reservationOptionText: '预约时段',
  today: '今天',
  dateText: '日期',
  dailyList: '活动日历',
  events: '当日活动',
  activityTitle: '活动名称',
  activitySubTitle: '活动说明',
  eventType: '活动类型',
  articleDto: '活动文章',
  content: '内容',
  subscribedEvents: '已订阅活动',
  trade_no: '订单号',
  finish_time: '答卷完成时间',
  satisfaction_description: '满意度描述',
  overall_satisfaction: '满意度评分',
  coupon_title: '答卷关联奖券',
  coupon_trade_start_time: '奖券可用起始时间',
  coupon_trade_end_time: '奖券可用截止时间',
  coupon_redeem_status: '奖券核销状态',
  coupon_available_redeem_count: '奖券剩余次数',
  coupon_order_food_types: '奖券点餐方式',
  supportModify: '支持特调',
  rounds: '套餐选配',
  choices: '可选餐品',
  isDefault: '默认选中',
  diffPrice: '相对默认餐品差价',
  minQuantity: '至少选择',
  maxQuantity: '最多选择',
  selectedQuantity: '当前数量',
  specList: '规格',
  specMain: '规格类型',
  specItem: '规格值',
  message: '服务提示',
  summary: '本次操作',
  consumption: '本次消耗',
  expiresAt: '确认有效期',
  promotionId: '促销编号',
  ruleDetail: '促销规则',
  orderDiscount: '满额折扣',
  orderReduce: '满额立减',
  reduceInfo: '立减阶梯',
  reduceAmount: '立减金额（元）',
  startDiscountPoint: '折扣门槛（元）',
  startDiscountPointValue: '折扣门槛',
  startDiscountPointType: '门槛类型',
  startTime: '开始时间',
  endDate: '结束日期',
  hasNext: '还有下一页',
  hasMore: '还有更多',
  dateTime: '服务时间',
  timezone: '时区',
  formatted: '完整时间',
  currentTime: '当前服务时间',
  cancelResult: '取消结果',
  orderDetail: '订单详情',
  orderItemStatus: '兑换结果',
  orderItemId: '兑换项目',
  receiveQuantity: '收到数量',
  couponCodes: '券码',
  list: '记录',
  nutrition: '营养数据',
  energy: '能量',
  protein: '蛋白质',
  fat: '脂肪',
  carbohydrate: '碳水',
  sodium: '钠',
  calcium: '钙',
};
const enums: Record<string, [string, unknown][]> = {
  beType: [
    ['到店自取', 1],
    ['麦乐送', 2],
    ['得来速', 5],
    ['企业团餐', 6],
  ],
  orderType: [
    ['到店取餐', 1],
    ['外送 / 团餐', 2],
  ],
  searchType: [
    ['按位置搜索', 2],
    ['收藏门店', 1],
  ],
  partyType: [
    ['包场', 1],
    ['拼团', 2],
  ],
  spuCategory: [
    ['餐品券', '1'],
    ['实物周边', '2'],
  ],
  gender: [
    ['先生', '先生'],
    ['女士', '女士'],
  ],
  cancelReasonCode: [
    ['改主意了', '1'],
    ['重复下单', '2'],
    ['餐品选错了', '3'],
    ['地址 / 电话有误', '4'],
    ['送达时间有误', '5'],
    ['其他原因', '-1'],
  ],
  catRuleIds: [
    ['餐品券', '1>4'],
    ['实物周边', '2>8'],
    ['实物礼品卡', '2>9'],
    ['生日派对', '1>6>20'],
    ['主题派对', '1>6>21'],
    ['麦麦体验营', '1>6>22'],
    ['品鉴会', '1>6>25'],
    ['读书会', '1>6>34'],
    ['积分兑换活动', '1>6>40'],
  ],
};

async function api(path: string, body?: unknown) {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '补给信号暂时中断，请稍后重试。');
  return data;
}
function canonical(name: string) {
  return name.replace(/^mcp__mcd_mcp__/, '').replaceAll('_', '-');
}
function object(value: unknown): Obj {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Obj) : {};
}
function shortDescription(value?: string) {
  return (value || '')
    .split('\n')[0]
    .replace(/Description:\s*/, '')
    .slice(0, 120);
}
function invalidate(previous: Obj, key: string, party: boolean): Obj {
  const next = { ...previous };
  const session = ['id', 'timeStart', 'timeEnd', 'leftNum'];
  const meal = ['code', 'items', 'couponId', 'couponCode', 'gmServiceCode', 'takeWayCode'];
  let downstream: string[] = [];
  if (['city', 'keyword', 'beType', 'addressId'].includes(key))
    downstream = ['storeCode', 'beCode', ...meal];
  if (['storeCode', 'beCode', 'reservationDate'].includes(key))
    downstream = party ? ['dateStr', ...session] : meal;
  if (key === 'spuId')
    downstream = [
      'skuId',
      'spuCategory',
      'shopId',
      'code',
      'latitude',
      'longitude',
      'storeCode',
      'dateStr',
      ...session,
    ];
  if (key === 'code' && party) downstream = ['storeCode', 'dateStr', ...session];
  if (key === 'dateStr') downstream = session;
  for (const field of downstream) delete next[field];
  return next;
}

function Field({
  field,
  schema: original,
  value,
  onChange,
  required = false,
  level = 0,
}: {
  field: string;
  schema: Schema;
  value: unknown;
  onChange: (value: unknown) => void;
  required?: boolean;
  level?: number;
}) {
  const schema =
    original.anyOf?.find((item) => item.type !== 'null') || original.oneOf?.[0] || original;
  const label = labels[field] || field;
  const options =
    schema.enum?.map(
      (item) =>
        [
          enums[field]?.find((pair) => String(pair[1]) === String(item))?.[0] || String(item),
          item,
        ] as [string, unknown],
    ) || enums[field];
  if (schema.type === 'object' || schema.properties)
    return (
      <fieldset className="nested-field">
        <legend>
          {label}
          {required ? ' *' : ''}
        </legend>
        {Object.entries(schema.properties || {}).map(([key, child]) => (
          <Field
            key={key}
            field={key}
            schema={child}
            value={object(value)[key]}
            onChange={(next) => onChange({ ...object(value), [key]: next })}
            required={schema.required?.includes(key)}
            level={level + 1}
          />
        ))}
      </fieldset>
    );
  if (schema.type === 'array') {
    const list = Array.isArray(value) ? value : [];
    return (
      <fieldset className="nested-field">
        <legend>
          {label}
          {required ? ' *' : ''}
        </legend>
        {list.map((entry, index) => (
          <div className="array-item" key={index}>
            <Field
              field={`${field}${index + 1}`}
              schema={schema.items || { type: 'string' }}
              value={entry}
              onChange={(next) => onChange(list.map((item, i) => (i === index ? next : item)))}
              level={level + 1}
            />
            <button
              type="button"
              className="text-button"
              onClick={() => onChange(list.filter((_, i) => i !== index))}
            >
              移除第 {index + 1} 项
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button button-small button-outline"
          onClick={() => onChange([...list, schema.items?.type === 'object' ? {} : ''])}
        >
          + 添加{label}
        </button>
      </fieldset>
    );
  }
  if (schema.type === 'boolean')
    return (
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(event) => onChange(event.target.checked)}
        />
        {label}
      </label>
    );
  return (
    <label className="form-field">
      <span>
        {label}
        {required ? <b> *</b> : null}
      </span>
      {options ? (
        <select
          value={value === undefined ? '' : String(value)}
          required={required}
          onChange={(event) =>
            onChange(options.find((pair) => String(pair[1]) === event.target.value)?.[1])
          }
        >
          <option value="">请选择</option>
          {options.map(([title, item]) => (
            <option key={String(item)} value={String(item)}>
              {title}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={
            schema.type === 'number' || schema.type === 'integer'
              ? 'number'
              : field === 'phone'
                ? 'tel'
                : 'text'
          }
          min={schema.minimum}
          max={schema.maximum}
          step={schema.type === 'integer' ? 1 : 'any'}
          required={required}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(event) =>
            onChange(
              event.target.value === ''
                ? undefined
                : schema.type === 'number' || schema.type === 'integer'
                  ? Number(event.target.value)
                  : event.target.value,
            )
          }
          placeholder={
            field === 'reservationDate' ? '2026-10-09 12:00' : shortDescription(schema.description)
          }
        />
      )}
    </label>
  );
}

function ResultView({
  value,
  select,
  depth = 0,
  parent = '',
}: {
  value: unknown;
  select?: (row: Obj) => void;
  depth?: number;
  parent?: string;
}): ReactNode {
  if (value === null || value === undefined) return <span className="muted">暂无数据</span>;
  if (typeof value === 'boolean')
    return <span className={value ? 'result-yes' : 'muted'}>{value ? '是' : '否'}</span>;
  if (typeof value !== 'object') {
    const text = String(value);
    if (/^https:\/\//.test(text) && /pay|url/i.test(parent))
      return (
        <a
          className="button button-small button-orange"
          href={text}
          target="_blank"
          rel="noopener noreferrer"
        >
          打开官方页面 <ArrowRight size={14} />
        </a>
      );
    return <span className="result-text">{text}</span>;
  }
  if (Array.isArray(value))
    return value.length ? (
      <div className={depth < 2 ? 'result-cards' : 'result-list'}>
        {value.map((entry, index) => (
          <div key={index} className={depth < 2 ? 'result-card' : 'result-list-item'}>
            <ResultView value={entry} depth={depth + 1} parent={parent} />
            {select && typeof entry === 'object' && entry && (
              <button
                className="button button-small button-outline result-select"
                onClick={() => select(object(entry))}
              >
                选择这一项 <ArrowRight size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    ) : (
      <div className="empty-state compact">这里还没有内容，试试其他选择。</div>
    );
  const obj = object(value);
  return (
    <dl className={`result-facts depth-${Math.min(depth, 3)}`}>
      {Object.entries(obj)
        .filter(
          ([key]) =>
            ![
              'traceId',
              'code',
              'image',
              'imageUrl',
              'productImage',
              'couponImage',
              'spuImage',
              'activityBgImg',
              'images',
              'imgList',
              'couponCode',
              'couponCodes',
              'lockerQrCode',
              'selectedKey',
              'unselectedKey',
            ].includes(key) ||
            (key === 'code' && typeof obj[key] !== 'number'),
        )
        .map(([key, item]) => (
          <div className="result-fact" key={key}>
            <dt>
              {key === 'skuList'
                ? '可选规格'
                : key === 'addresses'
                  ? '配送地址'
                  : labels[key] ||
                    (
                      {
                        currentPrice: '当前价格（元）',
                        chances: '抽奖次数',
                        text: '服务说明',
                        fullAddress: '完整地址',
                        skuList: '可选规格',
                        currentDate: '服务日期',
                        formattedTime: '服务时间',
                        status: '执行状态',
                        name: '操作名称',
                        createdAt: '提交时间',
                        requestId: '请求编号',
                        confirmationId: '确认编号',
                        result: '执行结果',
                      } as Record<string, string>
                    )[key] ||
                    key}
            </dt>
            <dd>
              <ResultView
                value={item}
                depth={depth + 1}
                parent={key}
                select={
                  ['list', 'addresses', 'skuList', 'mealAssistanceItems', 'takeWayList'].includes(
                    key,
                  )
                    ? select
                    : undefined
                }
              />
            </dd>
          </div>
        ))}
    </dl>
  );
}

export function ScenePanel({
  scene,
  profile,
  mode,
  store,
  cart,
  onClose,
  initialPreview,
}: {
  scene: SceneId;
  profile: Profile;
  mode: Mode;
  store?: Store;
  cart?: CartItem[];
  onClose: () => void;
  initialPreview?: Obj;
}) {
  const info = scenes[scene];
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [active, setActive] = useState(info.actions[0][0]);
  const [context, setContext] = useState<Obj>({
    city: profile.city,
    keyword: profile.location,
    searchType: 2,
    beType: scene === 'team' ? 6 : 1,
    orderType: scene === 'team' ? 2 : 1,
    storeCode: store?.storeCode,
    beCode: store?.beCode,
    items: cart?.length ? cart : undefined,
    count: 1,
    partyType: 2,
    catRuleIds: scene === 'party' ? '1>6>25' : '1>4',
    cancelReasonCode: '1',
  });
  const [result, setResult] = useState<unknown>();
  const [resultTool, setResultTool] = useState('');
  const [preview, setPreview] = useState<Obj | undefined>(initialPreview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [pendingActions, setPendingActions] = useState<unknown[]>([]);
  useEffect(() => {
    let alive = true;
    api('/api/mcp/tools')
      .then((data) => {
        if (alive) setTools(data.tools);
      })
      .catch((error) => {
        if (alive) setError(error.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (scene !== 'orders') return;
    let alive = true;
    api('/api/mcp/actions')
      .then((data) => {
        if (alive) setPendingActions(data.actions || []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [scene]);
  const definition = tools.find((tool) => canonical(tool.name) === active);
  const schema = (definition?.inputSchema || {}) as Schema;
  const properties = schema.properties || {};
  const required = schema.required || [];
  const standardKeys = new Set([
    'city',
    'keyword',
    'beType',
    'searchType',
    'orderType',
    'storeCode',
    'addressId',
    'spuId',
    'skuId',
    'code',
    'dateStr',
    'partyType',
    'count',
    'orderId',
    'cancelReasonCode',
    'catRuleIds',
    'items',
    'contactName',
    'gender',
    'phone',
    'address',
    'addressDetail',
    'takeWayCode',
    'gmServiceCode',
  ]);
  function change(key: string, value: unknown) {
    setContext((previous) => {
      const next = { ...invalidate(previous, key, scene === 'party'), [key]: value };
      if (key === 'beType') {
        next.orderType = Number(value) === 2 || Number(value) === 6 ? 2 : 1;
        if (Number(value) === 1) delete next.beCode;
      }
      return next;
    });
    setPreview(undefined);
    if (
      [
        'city',
        'keyword',
        'beType',
        'addressId',
        'storeCode',
        'beCode',
        'reservationDate',
        'spuId',
        'dateStr',
      ].includes(key) ||
      (key === 'code' && scene === 'party')
    ) {
      setResult(undefined);
      setSelection('');
    }
  }
  function select(row: Obj) {
    const next: Obj = {};
    let nextTool = '';
    if (resultTool === 'mall-points-products') {
      next.spuId = row.spuId;
      next.shopId = row.shopId;
      nextTool = 'mall-product-detail';
    }
    if (resultTool === 'mall-product-detail') {
      next.skuId = row.skuId;
      const detail = object(object(result).data);
      next.spuId = detail.spuId || context.spuId;
      next.spuCategory = detail.spuCategory;
      next.shopId = detail.shopId;
      next.partyType = detail.partyType === -1 ? context.partyType : detail.partyType;
      nextTool = Number(detail.shopId) === 5 ? 'query-party-city' : 'mall-create-order';
    }
    if (resultTool === 'query-party-city') {
      next.code = String(row.code);
      next.latitude = row.latitude;
      next.longitude = row.longitude;
      nextTool = 'query-party-store';
    }
    if (resultTool === 'query-party-store') {
      next.storeCode = row.code || row.storeCode;
      nextTool = 'query-party-store-date';
    }
    if (resultTool === 'query-party-store-date') {
      next.dateStr = row.date;
      nextTool = 'query-party-store-session';
    }
    if (resultTool === 'query-party-store-session') {
      for (const key of ['id', 'timeStart', 'timeEnd', 'leftNum']) next[key] = row[key];
      nextTool = 'party-order-create';
    }
    if (resultTool === 'query-nearby-stores' || resultTool === 'delivery-query-stores') {
      next.storeCode = row.storeCode;
      next.beCode = row.beCode;
      nextTool = 'query-meals';
    }
    if (resultTool === 'delivery-query-addresses') {
      next.addressId = row.addressId || row.id;
      next.beType = scene === 'team' ? 6 : 2;
      next.orderType = 2;
      nextTool = 'delivery-query-stores';
    }
    if (resultTool === 'query-meals') {
      const code = String(row.code || row.productCode);
      next.code = code;
      const previous = Array.isArray(context.items) ? (context.items as CartItem[]) : [];
      const existing = previous.find((item) => item.productCode === code);
      next.items = existing
        ? previous.map((item) =>
            item.productCode === code ? { ...item, quantity: item.quantity + 1 } : item,
          )
        : [...previous, { productCode: code, quantity: 1 }];
      nextTool = scene === 'lab' ? 'query-meal-detail' : '';
    }
    if (resultTool === 'query-meal-assistance') {
      next.gmServiceCode = row.gmServiceCode || row.code;
      nextTool = 'calculate-price';
    }
    if (resultTool === 'order-list' || resultTool === 'mall-order-list') {
      next.orderId = row.orderId;
      nextTool = resultTool === 'order-list' ? 'query-order' : 'mall-order-detail';
    }
    if (resultTool === 'query-store-coupons') {
      next.couponId = row.couponId;
      next.couponCode = row.couponCode;
      const products = Array.isArray(row.products) ? row.products : [];
      if (products.length)
        next.items = [
          {
            productCode: object(products[0]).productCode,
            quantity: 1,
            couponId: row.couponId,
            couponCode: row.couponCode,
          },
        ];
    }
    if (resultTool === 'calculate-price') {
      next.takeWayCode = row.code;
      nextTool = 'create-order';
    }
    setContext((previous) => {
      let updated = { ...previous };
      for (const key of Object.keys(next)) updated = invalidate(updated, key, scene === 'party');
      return { ...updated, ...next };
    });
    setSelection(
      String(
        row.spuName ||
          row.name ||
          row.storeName ||
          row.fullAddress ||
          row.addressDetail ||
          row.date ||
          row.timeStart ||
          row.gmServiceName ||
          row.title ||
          row.orderId ||
          row.skuId ||
          '已选项目',
      ),
    );
    setPreview(undefined);
    setError('');
    if (nextTool && info.actions.some((action) => action[0] === nextTool)) setActive(nextTool);
  }
  async function run() {
    if (!definition) return;
    setBusy(true);
    setError('');
    setPreview(undefined);
    try {
      const args: Obj = {};
      for (const key of Object.keys(properties))
        if (context[key] !== undefined && context[key] !== '') args[key] = context[key];
      for (const [key, child] of Object.entries(properties))
        if (args[key] === undefined && (child.const !== undefined || child.default !== undefined))
          args[key] = child.const ?? child.default;
      if (Number(args.beType) === 1) delete args.beCode;
      const data = await api(definition.write ? '/api/mcp/preview' : '/api/mcp/read', {
        name: definition.name,
        args,
      });
      if (definition.write) {
        setPreview(data);
        setResult(undefined);
      } else {
        setResult(data.result);
        setResultTool(active);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '暂时没有连接成功。');
    } finally {
      setBusy(false);
    }
  }
  async function execute() {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/mcp/execute', { confirmationId: preview.confirmationId });
      setResult(data.result);
      setResultTool(active);
      setPreview(undefined);
    } catch (error) {
      setError(error instanceof Error ? error.message : '操作结果待确认，请查看订单记录。');
    } finally {
      setBusy(false);
    }
  }
  const payload = object(result).data ?? result;
  const raw = object(payload);
  let display: unknown = payload;
  if (resultTool === 'query-meals') {
    const list = raw.products || raw.productList || raw.list;
    if (Array.isArray(list)) display = list;
    else if (Array.isArray(raw.categories))
      display = (raw.categories as unknown[])
        .flatMap((item) => {
          const group = object(item);
          return (group.products || group.productList || group.meals || []) as unknown[];
        })
        .map((item) => {
          const row = object(item);
          return { ...object(object(raw.meals)[String(row.code)]), ...row };
        });
  }
  if (resultTool === 'mall-order-list' && Array.isArray(payload))
    display = payload.flatMap((item) => (object(item).list as unknown[]) || [item]);
  const selectable = new Set([
    'mall-points-products',
    'mall-product-detail',
    'query-party-city',
    'query-party-store',
    'query-party-store-date',
    'query-party-store-session',
    'query-nearby-stores',
    'delivery-query-stores',
    'delivery-query-addresses',
    'query-meals',
    'query-meal-assistance',
    'order-list',
    'mall-order-list',
    'query-store-coupons',
    'calculate-price',
  ]);
  return (
    <Modal title={`${info.icon} ${info.title}`} subtitle={info.description} onClose={onClose} wide>
      <div className="scene-layout">
        <aside className="scene-steps">
          <div className={`source-label ${mode}`}>
            {mode === 'demo' ? '演示世界 · 虚拟数据' : '实时连接 · 个人账户'}
          </div>
          {info.actions.map(([name, label], index) => (
            <button
              key={name}
              className={`scene-step ${active === name ? 'selected' : ''}`}
              onClick={() => {
                setActive(name);
                setPreview(undefined);
                setError('');
              }}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              {label}
              <ArrowRight size={14} />
            </button>
          ))}
          <p className="scene-note">
            选中的门店、商品和场次会带入下一步。
            {scene === 'party' ? '每一步由你亲自选择。' : '真实操作在确认后才执行。'}
          </p>
        </aside>
        <div className="scene-workspace">
          {scene === 'team' && (
            <TeamRoom
              onBudget={(people, budget) => {
                change('count', people);
                setSelection(
                  `${people} 人小队，合计预算 ¥${budget / 100}。请在下面挑选餐品并核算。`,
                );
              }}
            />
          )}
          {scene === 'orders' && pendingActions.length > 0 && (
            <details className="advanced-fields pending-actions">
              <summary>
                查看历史操作和待核实结果 <ChevronDown size={14} />
              </summary>
              <ResultView value={pendingActions} />
            </details>
          )}
          {selection && (
            <div className="selection-banner">
              <Check size={16} /> 已选：{selection}
            </div>
          )}
          {!initialPreview && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run();
              }}
            >
              <div className="scene-form-header">
                <div>
                  <span className="eyebrow">下一步 / NEXT STEP</span>
                  <h3>{info.actions.find((action) => action[0] === active)?.[1]}</h3>
                </div>
                {definition?.write ? <ShieldCheck size={24} /> : <WandSparkles size={24} />}
              </div>
              <div className="scene-fields">
                {Object.entries(properties)
                  .filter(([key]) => required.includes(key) || standardKeys.has(key))
                  .map(([key, child]) => (
                    <Field
                      key={`${active}-${key}`}
                      field={key}
                      schema={child}
                      value={context[key] ?? child.default ?? child.const}
                      required={required.includes(key)}
                      onChange={(value) => change(key, value)}
                    />
                  ))}
              </div>
              {Object.keys(properties).some(
                (key) => !required.includes(key) && !standardKeys.has(key),
              ) && (
                <details
                  className="advanced-fields"
                  open={advanced}
                  onToggle={(event) => setAdvanced(event.currentTarget.open)}
                >
                  <summary>
                    预约及更多选项 <ChevronDown size={14} />
                  </summary>
                  <div className="scene-fields">
                    {Object.entries(properties)
                      .filter(([key]) => !required.includes(key) && !standardKeys.has(key))
                      .map(([key, child]) => (
                        <Field
                          key={`${active}-${key}`}
                          field={key}
                          schema={child}
                          value={context[key] ?? child.default ?? child.const}
                          onChange={(value) => change(key, value)}
                        />
                      ))}
                  </div>
                </details>
              )}
              <div className="scene-form-footer">
                <p>
                  {definition?.write
                    ? '先查看操作摘要，然后确认执行。'
                    : '从补给服务读取当前数据。'}
                </p>
                <button
                  type="submit"
                  className="button button-orange"
                  disabled={busy || !definition}
                >
                  {busy ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : definition?.write ? (
                    <ShieldCheck size={17} />
                  ) : (
                    <Sparkles size={17} />
                  )}{' '}
                  {definition?.write ? '预览本次操作' : '查询并继续'}
                </button>
              </div>
            </form>
          )}
          {error && (
            <div role="alert" className="error-banner">
              {error}
            </div>
          )}
          {preview && (
            <div className="confirmation-card">
              <ShieldCheck size={30} />
              <span className="eyebrow">请确认本次操作</span>
              <h3>{mode === 'demo' ? '在演示世界执行' : '操作将影响你的真实账户'}</h3>
              <ResultView
                value={{
                  summary: preview.summary,
                  ...(preview.consumption ? { consumption: preview.consumption } : {}),
                  expiresAt: preview.expiresAt,
                }}
              />
              <details className="advanced-fields">
                <summary>
                  核对具体内容 <ChevronDown size={14} />
                </summary>
                <ResultView value={preview.args} />
              </details>
              <div className="confirmation-actions">
                <button
                  className="button button-outline"
                  disabled={busy}
                  onClick={() => {
                    setPreview(undefined);
                    if (initialPreview) onClose();
                  }}
                >
                  返回修改
                </button>
                <button
                  className="button button-orange"
                  disabled={busy}
                  onClick={() => void execute()}
                >
                  {busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}{' '}
                  确认执行一次
                </button>
              </div>
            </div>
          )}
          {result !== undefined && (
            <section className="scene-results" aria-live="polite">
              <div className="section-heading">
                <h3>来自补给站的回复</h3>
                <span className={`source-label ${mode}`}>
                  {mode === 'demo' ? '模拟结果' : '实时数据'}
                </span>
              </div>
              {resultTool === 'query-meal-detail' ? (
                <MealCustomizer
                  detail={payload}
                  onSave={(item) => {
                    const previous = Array.isArray(context.items)
                      ? (context.items as CartItem[])
                      : [];
                    change(
                      'items',
                      previous.some((entry) => entry.productCode === item.productCode)
                        ? previous.map((entry) =>
                            entry.productCode === item.productCode
                              ? { ...item, quantity: entry.quantity }
                              : entry,
                          )
                        : [...previous, item],
                    );
                    setActive('calculate-price');
                    setSelection('套餐和特调已保存，请核实搭配费用。');
                  }}
                />
              ) : (
                <ResultView
                  value={display}
                  select={selectable.has(resultTool) ? select : undefined}
                />
              )}{' '}
              {resultTool === 'mall-product-detail' && !!raw.note && (
                <div className="purchase-note">
                  <strong>购买须知</strong>
                  <p>{String(raw.note)}</p>
                </div>
              )}
              {resultTool === 'query-lottery-info' && (
                <div className="information-banner">
                  抽奖结果由官方服务决定。每次参加前会重新核实并展示本次消耗，随后由你单次确认。
                </div>
              )}
              <details className="advanced-fields">
                <summary>
                  查看完整服务回复 <ChevronDown size={14} />
                </summary>
                <pre className="raw-result">{JSON.stringify(result, null, 2)}</pre>
              </details>
            </section>
          )}
          {!result && !preview && !busy && (
            <div className="scene-empty">
              <div>{info.icon}</div>
              <h3>让下一次补给更有意思</h3>
              <p>从左侧选择你想做的事，点击查询开始探索。</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
