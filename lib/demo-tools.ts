import { randomUUID } from 'node:crypto';
import { db } from './db';
import type { Category, MealSlot } from './types';

export const DEMO_PRODUCTS: {
  code: string;
  name: string;
  cents: number;
  category: Category;
  kcal: number;
  protein: number;
  mealSlots: MealSlot[];
  emoji: string;
}[] = [
  {
    code: 'D101',
    name: '板烧鸡腿堡',
    cents: 1650,
    category: 'main',
    kcal: 420,
    protein: 24,
    mealSlots: ['lunch', 'dinner'],
    emoji: '🍔',
  },
  {
    code: 'D102',
    name: '麦香鸡',
    cents: 1100,
    category: 'main',
    kcal: 390,
    protein: 15,
    mealSlots: ['lunch', 'dinner'],
    emoji: '🍔',
  },
  {
    code: 'D103',
    name: '麦香鱼',
    cents: 1300,
    category: 'main',
    kcal: 350,
    protein: 17,
    mealSlots: ['lunch', 'dinner'],
    emoji: '🍔',
  },
  {
    code: 'D104',
    name: '双层吉士汉堡',
    cents: 1500,
    category: 'main',
    kcal: 450,
    protein: 25,
    mealSlots: ['lunch', 'dinner'],
    emoji: '🍔',
  },
  {
    code: 'D105',
    name: '巨无霸',
    cents: 2200,
    category: 'main',
    kcal: 520,
    protein: 28,
    mealSlots: ['lunch', 'dinner'],
    emoji: '🍔',
  },
  {
    code: 'D106',
    name: '猪柳麦满分',
    cents: 1200,
    category: 'main',
    kcal: 380,
    protein: 18,
    mealSlots: ['breakfast'],
    emoji: '🥯',
  },
  {
    code: 'D107',
    name: '猪柳蛋麦满分',
    cents: 1500,
    category: 'main',
    kcal: 420,
    protein: 24,
    mealSlots: ['breakfast'],
    emoji: '🥯',
  },
  {
    code: 'D201',
    name: '小薯条',
    cents: 700,
    category: 'side',
    kcal: 230,
    protein: 3,
    mealSlots: ['lunch', 'dinner'],
    emoji: '🍟',
  },
  {
    code: 'D202',
    name: '麦乐鸡（4块）',
    cents: 850,
    category: 'side',
    kcal: 185,
    protein: 12,
    mealSlots: ['lunch', 'dinner'],
    emoji: '🍗',
  },
  {
    code: 'D203',
    name: '薯饼',
    cents: 550,
    category: 'side',
    kcal: 150,
    protein: 2,
    mealSlots: ['breakfast'],
    emoji: '🥔',
  },
  {
    code: 'D301',
    name: '美式咖啡',
    cents: 800,
    category: 'drink',
    kcal: 4,
    protein: 0,
    mealSlots: ['breakfast', 'lunch', 'dinner'],
    emoji: '☕',
  },
  {
    code: 'D302',
    name: '零度可乐（小）',
    cents: 500,
    category: 'drink',
    kcal: 0,
    protein: 0,
    mealSlots: ['lunch', 'dinner'],
    emoji: '🥤',
  },
  {
    code: 'D303',
    name: '牛奶',
    cents: 650,
    category: 'drink',
    kcal: 130,
    protein: 7,
    mealSlots: ['breakfast', 'lunch', 'dinner'],
    emoji: '🥛',
  },
  {
    code: 'D304',
    name: '可乐（小）',
    cents: 500,
    category: 'drink',
    kcal: 100,
    protein: 0,
    mealSlots: ['lunch', 'dinner'],
    emoji: '🥤',
  },
  {
    code: 'D401',
    name: '圆筒冰淇淋',
    cents: 500,
    category: 'dessert',
    kcal: 140,
    protein: 3,
    mealSlots: ['lunch', 'dinner'],
    emoji: '🍦',
  },
  // Composite nutrition is intentionally excluded from the nutrition fixture below.
  {
    code: 'D501',
    name: '演示板烧双人套餐',
    cents: 4900,
    category: 'main',
    kcal: 0,
    protein: 0,
    mealSlots: ['lunch', 'dinner'],
    emoji: '🍱',
  },
];
export const demoDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
type State = {
  points: number;
  chances: number;
  coupons: boolean;
  addresses: any[];
  orders: any[];
  mallOrders: any[];
  prizes: any[];
};
function state(user: string): State {
  db().exec(
    'CREATE TABLE IF NOT EXISTS mcp_demo_state (user_id TEXT PRIMARY KEY, value TEXT NOT NULL)',
  );
  const row = db().prepare('SELECT value FROM mcp_demo_state WHERE user_id=?').get(user) as
    { value: string } | undefined;
  return row
    ? JSON.parse(row.value)
    : {
        points: 3600,
        chances: 1,
        coupons: false,
        addresses: [
          {
            addressId: 'DEMO-ADDR-1',
            contactName: '冒险家',
            phone: '13800000000',
            fullAddress: '成都市武侯区世外桃源酒店（演示地址）',
          },
        ],
        orders: [],
        mallOrders: [],
        prizes: [],
      };
}
function save(user: string, value: State) {
  db()
    .prepare(
      'INSERT INTO mcp_demo_state (user_id,value) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET value=excluded.value',
    )
    .run(user, JSON.stringify(value));
}
const coupons = [
  {
    couponId: 'DEMO-C1',
    couponCode: 'DEMO-CODE-1',
    title: '演示专属板烧立减3元',
    products: [{ productCode: 'D101', productName: '板烧鸡腿堡' }],
    tradeDateTime: '2026-01-01 00:00:00 - 2099-12-31 23:59:59',
  },
];
const mall = [
  {
    spuId: 201,
    spuName: '演示小薯条兑换券',
    shopId: 2,
    spuCategory: '1',
    point: '500',
    price: '0',
    status: 2,
    catName: '商品券',
  },
  {
    spuId: 202,
    spuName: '演示城市冒险徽章',
    shopId: 2,
    spuCategory: '2',
    point: '1600',
    price: '0',
    status: 2,
    catName: '周边产品',
  },
  {
    spuId: 501,
    spuName: '演示麦麦汉堡体验营',
    shopId: 5,
    spuCategory: '1',
    point: '800',
    price: '0',
    status: 2,
    catName: '麦麦体验营',
  },
];
const fail = (message: string): never => {
  throw new Error(message);
};
export function demoCall(user: string, name: string, args: Record<string, any>): any {
  const v = state(user),
    date = demoDate();
  const wrap = (data: any) => ({
    code: 200,
    message: '演示数据：未调用真实麦当劳账户',
    data,
    _source: 'demo',
  });
  const stores = [
    {
      storeCode: '3450082',
      storeName: '麦当劳成都磨子桥餐厅',
      address: '一环路南二段1号磨子桥',
      distance: 567,
      businessStatus: true,
      businessStartTime: '00:00',
      businessEndTime: '23:59',
    },
    {
      storeCode: '3450271',
      storeName: '麦当劳成都科华北路餐厅',
      address: '科华北路60号',
      distance: 626,
      businessStatus: true,
      businessStartTime: '00:00',
      businessEndTime: '23:59',
    },
    {
      storeCode: '3450063',
      storeName: '麦当劳成都来福士广场餐厅',
      address: '成都来福士广场负二楼',
      distance: 953,
      businessStatus: true,
      businessStartTime: '08:00',
      businessEndTime: '22:00',
    },
  ].map((s) => ({
    ...s,
    ...(args.beType !== 1 ? { beCode: `DEMO-BE-${args.beType}-${s.storeCode}` } : {}),
    reservation: true,
    reservationTimeOptions: [
      {
        date,
        today: true,
        reservationOptionText:
          '早餐 08:14–10:15；午餐 10:44–14:15；下午茶 14:44–16:45；夜市 17:14–21:45',
      },
    ],
  }));
  switch (name) {
    case 'query-nearby-stores':
      return wrap(stores);
    case 'delivery-query-addresses':
      return wrap({ addresses: v.addresses });
    case 'delivery-create-address': {
      const a = {
        addressId: `DEMO-ADDR-${randomUUID()}`,
        contactName: args.contactName,
        phone: args.phone,
        fullAddress: `${args.city}${args.address}${args.addressDetail}`,
      };
      v.addresses.push(a);
      save(user, v);
      return wrap(a);
    }
    case 'delivery-query-stores':
      if (!v.addresses.some((a) => a.addressId === args.addressId)) fail('演示地址不存在');
      return wrap(stores);
    case 'now-time-info':
      return wrap({
        timestamp: Date.now(),
        datetime: new Intl.DateTimeFormat('zh-CN', {
          timeZone: 'Asia/Shanghai',
          dateStyle: 'short',
          timeStyle: 'medium',
        }).format(new Date()),
        timezone: 'Asia/Shanghai',
        date,
      });
    case 'campaign-calendar':
      return wrap({
        currentTime: new Date().toISOString(),
        dailyList: [
          {
            date: args.specifiedDate || date,
            today: !args.specifiedDate || args.specifiedDate === date,
            events: [
              {
                activityTitle: '城市补给日',
                activitySubTitle: '演示活动：寻找适合你的午餐组合',
                eventType: 0,
              },
              {
                activityTitle: '麦麦汉堡体验营',
                activitySubTitle: '演示活动：完成城市、门店、日期与场次选择',
                eventType: 6,
              },
            ],
          },
        ],
        subscribedEvents: [],
      });
    case 'query-meals':
      return wrap({
        categories: ['main', 'side', 'drink', 'dessert'].map((c) => ({
          name: ({ main: '汉堡与早餐', side: '薯条小食', drink: '饮品', dessert: '甜品' } as any)[
            c
          ],
          meals: DEMO_PRODUCTS.filter((p) => p.category === c).map((p) => ({
            code: p.code,
            tags: p.mealSlots,
          })),
        })),
        meals: Object.fromEntries(
          DEMO_PRODUCTS.map((p) => [
            p.code,
            {
              name: p.name,
              currentPrice: (p.cents / 100).toFixed(2),
              originalPrice: (p.cents / 100).toFixed(2),
              category: p.category,
              mealSlots: p.mealSlots,
              emoji: p.emoji,
            },
          ]),
        ),
        frequent: { code: 'D101', tags: ['推荐'] },
      });
    case 'list-nutrition-foods':
      return wrap(
        JSON.stringify(
          DEMO_PRODUCTS.filter((p) => p.code !== 'D501').map((p) => ({
            name: p.name,
            kcal: p.kcal,
            protein: p.protein,
            unit: '每份',
            source: '演示营养值',
          })),
        ),
      );
    case 'query-meal-detail': {
      const p = DEMO_PRODUCTS.find((p) => p.code === args.code);
      if (!p) fail('未找到演示商品');
      const rounds =
        p!.code === 'D501'
          ? [
              {
                id: 1,
                name: '主食',
                minQuantity: 2,
                maxQuantity: 2,
                quantity: 2,
                choices: [
                  {
                    code: 'D101',
                    name: '板烧鸡腿堡',
                    isDefault: 1,
                    quantity: 2,
                    maxQuantity: 2,
                    diffPrice: '0',
                    supportModify: false,
                  },
                  {
                    code: 'D104',
                    name: '双层吉士汉堡',
                    isDefault: 0,
                    quantity: 0,
                    maxQuantity: 2,
                    diffPrice: '-1.5',
                    supportModify: false,
                  },
                ],
              },
              {
                id: 2,
                name: '饮品',
                minQuantity: 2,
                maxQuantity: 2,
                quantity: 2,
                choices: [
                  {
                    code: 'D302',
                    name: '零度可乐（小）',
                    isDefault: 1,
                    quantity: 2,
                    maxQuantity: 2,
                    diffPrice: '0',
                    supportModify: false,
                  },
                  {
                    code: 'D303',
                    name: '牛奶',
                    isDefault: 0,
                    quantity: 0,
                    maxQuantity: 2,
                    diffPrice: '1.5',
                    supportModify: false,
                  },
                ],
              },
            ]
          : [];
      return wrap({
        code: p!.code,
        name: p!.name,
        supportModify: p!.category === 'main' && p!.code !== 'D501',
        rounds,
        modification: {
          items:
            p!.category === 'main' && p!.code !== 'D501'
              ? [
                  {
                    minValues: 0,
                    maxValues: 1,
                    values: [
                      {
                        code: 'DEMO-SAUCE',
                        name: '酱料',
                        selectedKey: 'WITH-SAUCE',
                        unselectedKey: 'NO-SAUCE',
                        selectedQuantity: 1,
                        minQuantity: 0,
                        maxQuantity: 1,
                        price: 0,
                      },
                    ],
                  },
                ]
              : [],
        },
      });
    }
    case 'available-coupons':
      return wrap([
        {
          couponName: coupons[0].title,
          couponStatus: v.coupons ? '已领取' : '可领取',
          label: '演示立减',
        },
      ]);
    case 'auto-bind-coupons':
      v.coupons = true;
      save(user, v);
      return wrap({
        successCount: 1,
        failedCount: 0,
        totalCount: 1,
        successCoupons: coupons.map((c) => ({ ...c, couponName: c.title })),
      });
    case 'query-my-coupons':
      return wrap({
        coupons: v.coupons
          ? coupons.map((c) => ({
              id: c.couponId,
              code: c.couponCode,
              title: c.title,
              enable: 1,
              datetimeText: c.tradeDateTime,
              discountInfo: { discountDesc: '板烧鸡腿堡立减3元', discountValue: '3' },
            }))
          : [],
        currentPage: 1,
        pageSize: 200,
        totalCount: v.coupons ? 1 : 0,
        totalPages: 1,
      });
    case 'query-store-coupons':
      return wrap(v.coupons ? coupons : []);
    case 'query-promotions':
      return wrap([
        {
          promotionId: 'DEMO-P1',
          promotionType: '31',
          ruleCategory: 40,
          beTypes: ['6'],
          products: [{ type: '3' }],
          ruleDetail: {
            orderReduce: {
              reduceInfo: [
                { startDiscountPoint: '100', reduceAmount: '15' },
                { startDiscountPoint: '200', reduceAmount: '35' },
              ],
            },
          },
        },
      ]);
    case 'query-meal-assistance':
      return wrap({
        mealAssistanceItems: [
          {
            enable: true,
            selected: true,
            gmServiceCode: 'DEMO-GM1',
            gmServiceName: '统一配送',
            serviceItems: ['演示：一次配送到指定地点'],
          },
        ],
      });
    case 'calculate-price': {
      let original = 0,
        discount = 0;
      const used = new Set<string>();
      const productList = (args.items || []).map((i: any) => {
        const p = DEMO_PRODUCTS.find((p) => p.code === i.productCode);
        if (!p) fail('演示菜单没有该商品');
        let unit = p!.cents;
        if (p!.code === 'D501' && i.roundList) {
          for (const round of i.roundList)
            for (const choice of round.comboItemList ?? []) {
              if (String(round.round) === '1' && choice.code === 'D104')
                unit -= 150 * choice.quantity;
              if (String(round.round) === '2' && choice.code === 'D303')
                unit += 150 * choice.quantity;
            }
        }
        original += unit * i.quantity;
        let off = 0;
        if (i.couponId) {
          if (
            !v.coupons ||
            i.couponId !== 'DEMO-C1' ||
            i.couponCode !== 'DEMO-CODE-1' ||
            p!.code !== 'D101' ||
            used.has(i.couponId)
          )
            fail('演示优惠券不可用于当前商品或重复使用');
          used.add(i.couponId);
          off = 300;
          discount += off;
        }
        return {
          productCode: p!.code,
          productName: p!.name,
          quantity: i.quantity,
          originalSubtotal: unit * i.quantity,
          subtotal: unit * i.quantity - off,
        };
      });
      if (args.beType === 6) discount += original >= 20000 ? 3500 : original >= 10000 ? 1500 : 0;
      const deliveryPrice = args.orderType === 2 ? 600 : 0,
        packingPrice = args.orderType === 2 ? 200 : 0,
        tablewarePrice = args.needTableware ? 100 : 0;
      return wrap({
        originalPrice: original + deliveryPrice + packingPrice + tablewarePrice,
        price: original - discount + deliveryPrice + packingPrice + tablewarePrice,
        discount,
        productOriginalPrice: original,
        productPrice: original - discount,
        deliveryPrice,
        packingPrice,
        tablewarePrice,
        productList,
        takeWayList:
          args.orderType === 1
            ? [
                {
                  code: args.beType === 5 ? 'DT' : 'PICKUP',
                  title: args.beType === 5 ? '得来速车道' : '到店自取',
                },
                { code: 'DINEIN', title: '堂食' },
              ]
            : [],
      });
    }
    case 'query-my-account':
      return wrap({
        availablePoint: String(v.points),
        currentMouthExpirePoint: '600',
        nextMouthExpirePoint: '800',
        accumulativePoint: '5000',
        usedPoint: String(5000 - v.points),
        frozenPoint: '0',
      });
    case 'mall-points-products':
      return wrap(
        mall.filter(
          (p) =>
            !args.catRuleIds ||
            args.catRuleIds
              .split(',')
              .some((c: string) =>
                c.startsWith('1>6')
                  ? p.shopId === 5
                  : c.startsWith('2')
                    ? p.spuCategory === '2'
                    : p.shopId === 2 && p.spuCategory === '1',
              ),
        ),
      );
    case 'mall-product-detail': {
      const p = mall.find((p) => p.spuId === args.spuId);
      if (!p) fail('未找到演示商品');
      return wrap({
        ...p,
        skuList: [
          {
            skuId: p!.spuId * 10,
            points: p!.point,
            price: p!.price,
            specList: [{ specMain: '规格', specItem: '标准' }],
          },
        ],
        note: '演示购买须知：所有商品、库存、价格及场次均为模拟数据，不发生真实扣费。',
        partyType: p!.shopId === 5 ? 2 : undefined,
        partyPeople: '以活动实际下单校验为准',
      });
    }
    case 'mall-create-order': {
      const p = mall.find((p) => p.spuId * 10 === args.skuId && p.shopId === 2);
      if (!p) fail('该SKU不支持普通商城兑换');
      const point = Number(p!.point) * (args.count || 1);
      if (v.points < point) fail('演示积分不足');
      v.points -= point;
      const o = {
        orderId: `DEMO-MALL-${randomUUID()}`,
        status: 1,
        point,
        amount: '0.00',
        orderStatus: 6,
        goods: [{ ...p, count: args.count || 1 }],
        coupons:
          p!.spuCategory === '1'
            ? [
                {
                  couponId: 'DEMO-REDEEM-1',
                  couponCodes: ['DEMO-REDEEM-CODE'],
                  receiveQuantity: args.count || 1,
                  orderItemStatus: 1,
                },
              ]
            : [],
      };
      v.mallOrders.unshift(o);
      save(user, v);
      return wrap(o);
    }
    case 'mall-order-list':
      return wrap([
        {
          hasNext: false,
          lastId: 1,
          list: v.mallOrders.map((o) => ({
            ...o,
            totalCount: 1,
            orderStatusTitle: '演示兑换完成',
          })),
        },
      ]);
    case 'mall-order-detail': {
      const o = v.mallOrders.find((o) => o.orderId === args.orderId);
      if (!o) fail('未找到本人演示商城订单');
      return wrap({
        ...o,
        orderStatusTitle: '演示订单已完成',
        orderStatusSubTitle: '没有发生真实扣费',
        payStatus: 1,
      });
    }
    case 'query-party-city':
      return wrap([
        { code: 510100, name: '成都市', latitude: 30.5728, longitude: 104.0668, initial: 'C' },
      ]);
    case 'query-party-store':
      return wrap([
        {
          code: '3450082',
          name: '演示磨子桥活动餐厅',
          address: '一环路南二段1号',
          latitude: 30.629,
          longitude: 104.07,
          businessStatus: 1,
          onlineBusinessStatus: true,
          cityCode: '510100',
          cityName: '成都市',
        },
      ]);
    case 'query-party-store-date':
      return wrap([{ date, storeCode: args.storeCode, spuId: args.spuId }]);
    case 'query-party-store-session':
      return wrap([
        {
          id: 9001,
          leftNum: 12,
          partyMax: 12,
          partyMin: 1,
          price: 0,
          timeStart: '14:00',
          timeEnd: '15:00',
        },
        {
          id: 9002,
          leftNum: 8,
          partyMax: 12,
          partyMin: 1,
          price: 0,
          timeStart: '16:00',
          timeEnd: '17:00',
        },
      ]);
    case 'party-order-create': {
      const points = 800 * args.count;
      if (v.points < points) fail('演示积分不足');
      v.points -= points;
      const o = {
        orderId: `DEMO-PARTY-${randomUUID()}`,
        status: 1,
        orderStatus: 6,
        point: points,
        amount: '0.00',
        orderPartyInfo: { ...args },
        goods: [{ spuId: 501, skuId: 5010, spuName: mall[2].spuName, count: args.count }],
      };
      v.mallOrders.unshift(o);
      save(user, v);
      return wrap(o);
    }
    case 'query-lottery-info':
      return wrap({
        activityCode: 'DEMO-LOTTERY',
        activityName: '演示幸运站',
        activityStatusText: '进行中',
        beginTime: '2026-01-01',
        endTime: '2099-12-31',
        availablePoint: String(v.points),
        availableTimes: v.chances,
        drawPoint: '100',
        drawTypeText: '先消耗次数再消耗积分抽奖',
        drawDecision: {
          resourceEligible: v.chances > 0 || v.points >= 100,
          nextConsumption:
            v.chances > 0
              ? { type: 'CHANCES', chances: 1, points: '0', text: '本次使用1次演示抽奖机会' }
              : { type: 'POINTS', chances: 0, points: '100', text: '本次消耗100演示积分' },
          fallbackConsumption:
            v.chances > 0
              ? { type: 'POINTS', points: '100', text: '次数用完后每次消耗100演示积分' }
              : null,
        },
        prizes: [{ name: '城市幸运徽章（演示）', typeText: '虚拟徽章' }],
      });
    case 'draw-lottery': {
      if (v.chances > 0) v.chances--;
      else if (v.points >= 100) v.points -= 100;
      else fail('演示积分不足');
      const win = v.prizes.length % 2 === 0;
      const prize = {
        id: randomUUID(),
        name: '城市幸运徽章（演示）',
        typeText: '虚拟徽章',
        statusText: '可用',
        recordTime: new Date().toISOString(),
        validDateInfo: '演示无期限',
      };
      if (win) v.prizes.unshift(prize);
      save(user, v);
      return wrap({
        status: { code: 'SUCCESS', message: '演示抽奖完成' },
        win,
        prizes: win ? [prize] : [],
      });
    }
    case 'query-my-prizes': {
      const start = ((args.pageNum || 1) - 1) * (args.pageSize || 10),
        end = start + (args.pageSize || 10);
      return wrap({
        prizes: v.prizes.slice(start, end),
        pageNum: args.pageNum || 1,
        pageSize: args.pageSize || 10,
        hasMore: end < v.prizes.length,
        nextCursor: end < v.prizes.length ? String(end) : '',
      });
    }
    case 'create-order': {
      const quote = demoCall(user, 'calculate-price', args).data;
      const o = {
        orderId: `DEMO-ORDER-${randomUUID()}`,
        orderStatus: '1',
        status: '演示待支付',
        createTime: new Date().toISOString(),
        storeName: stores.find((s) => s.storeCode === args.storeCode)?.storeName,
        storeAddress: stores.find((s) => s.storeCode === args.storeCode)?.address,
        storeCode: args.storeCode,
        beType: String(args.beType),
        beCode: args.beCode,
        orderType: String(args.orderType),
        orderProductList: quote.productList,
        realTotalAmount: (quote.price / 100).toFixed(2),
        pickupCode: 'D101',
        takeWay: args.takeWayCode || '演示配送',
        expirePayTime: new Date(Date.now() + 15 * 60000).toISOString(),
      };
      v.orders.unshift(o);
      save(user, v);
      return wrap({ orderId: o.orderId, orderDetail: o, demoPayment: true });
    }
    case 'order-list':
      return wrap({ list: v.orders });
    case 'query-order': {
      const o = v.orders.find((o) => o.orderId === args.orderId);
      if (!o) fail('未找到本人演示订单');
      return wrap(o);
    }
    case 'cancel-order': {
      const o = v.orders.find((o) => o.orderId === args.orderId);
      if (!o) fail('未找到本人演示订单');
      o.orderStatus = '7';
      o.status = '演示已取消';
      save(user, v);
      return wrap({ cancelResult: true, orderId: o.orderId });
    }
    case 'query-survey-coupon':
      if (!v.orders.some((o) => o.orderId === args.orderId)) fail('未找到本人演示订单');
      return wrap({
        trade_no: args.orderId,
        satisfaction_description: '演示订单尚无满意度答卷',
        coupon_redeem_status: '无关联奖券',
      });
    default:
      return fail('未实现的演示工具');
  }
}
