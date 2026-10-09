import { decode } from '@toon-format/toon';
import type { Category, MenuProduct, MealSlot, Store } from './types';

/** Decode only serialized data. Tool descriptions and remote prose are never executed. */
export function parseDataText(text: string): any {
  const original = text
    .split(/## Original Response\s*/)
    .at(-1)!
    .trim();
  const clean = original
    .replace(/^```(?:json|toon)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return JSON.parse(clean);
  } catch {
    /* Some endpoints use TOON. */
  }
  try {
    const value = decode(clean);
    if (typeof value === 'object' && value !== null) return value;
  } catch {
    /* Keep unsupported data as plain text. */
  }
  return text;
}
export const businessData = (raw: any): any =>
  typeof raw?.data === 'string' ? parseDataText(raw.data) : (raw?.data ?? raw);
const num = (v: unknown): number | undefined =>
  v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined;
export function normalizeStores(raw: any, beType: 1 | 2 | 5 | 6): Store[] {
  const d = businessData(raw);
  const list = Array.isArray(d) ? d : (d?.stores ?? d?.list ?? []);
  return list
    .filter((s: any) => s.storeCode || s.code)
    .map((s: any) => ({
      storeCode: String(s.storeCode ?? s.code),
      storeName: String(s.storeName ?? s.name ?? s.shortName ?? '门店'),
      address: String(s.address ?? s.storeAddress ?? ''),
      distance: num(s.distance) ?? 0,
      businessStatus: s.businessStatus === true || s.businessStatus === 1,
      beType,
      ...(s.beCode ? { beCode: String(s.beCode) } : {}),
    }));
}
function category(name: string, group: string, explicit: unknown): Category {
  if (['main', 'side', 'drink', 'dessert'].includes(String(explicit))) return explicit as Category;
  if (/冰淇淋|新地|麦旋风|拉明顿|阿芙佳朵|派$|甜品/.test(name) || /甜品|甜点/.test(group))
    return 'dessert';
  if (
    /咖啡|美式|奶铁|牛奶|豆浆|可乐|雪碧|果汁|红茶|奶茶|饮料|怡泉|纯悦|麦旋酷|雪冰|朱古力/.test(
      name,
    ) ||
    /饮品/.test(group)
  )
    return 'drink';
  if (
    /汉堡|堡|麦满分|巨无霸|麦香鸡|麦香鱼|卷|粥|餐|件套/.test(name) ||
    /汉堡|早餐|套餐|主食/.test(group)
  )
    return 'main';
  return 'side';
}
export function normalizeMenu(raw: any, nutritionRaw: any): MenuProduct[] {
  const menu = businessData(raw),
    nutrition = businessData(nutritionRaw);
  const nutrients = Array.isArray(nutrition)
    ? nutrition
    : (nutrition?.foods ?? nutrition?.list ?? []);
  const byName = new Map<string, any>();
  for (const nutrient of nutrients) {
    const name = String(nutrient.productName ?? nutrient.name ?? '').trim();
    if (name) byName.set(name, nutrient);
  }
  const groupMap = new Map<string, { name: string; tags: string[] }>();
  for (const group of menu?.categories ?? [])
    for (const meal of group.meals ?? []) {
      const prev = groupMap.get(String(meal.code));
      groupMap.set(String(meal.code), {
        name: [prev?.name, String(group.name)].filter(Boolean).join(' / '),
        tags: [...(prev?.tags ?? []), ...(meal.tags ?? [])],
      });
    }
  const source = raw?._source === 'demo' ? 'demo' : 'live';
  return Object.entries(menu?.meals ?? {}).flatMap(([code, value]) => {
    const p = value as any;
    const name = String(p.name ?? '').trim();
    if (!name) return [];
    const price = num(p.canWithOrder ? p.originalPrice : p.currentPrice) ?? num(p.originalPrice);
    if (price === undefined || price < 0) return [];
    const group = groupMap.get(code),
      kind = category(name, group?.name ?? '', p.category),
      nutrient = byName.get(name);
    const kcal = num(nutrient?.energyKcal ?? nutrient?.kcal ?? nutrient?.calories),
      protein = num(nutrient?.protein);
    const breakfast = /麦满分|早餐|早安|薯饼|油条|粥/.test(name);
    const slots: MealSlot[] = Array.isArray(p.mealSlots)
      ? p.mealSlots
      : breakfast
        ? ['breakfast']
        : kind === 'drink'
          ? ['breakfast', 'lunch', 'dinner']
          : ['lunch', 'dinner'];
    return [
      {
        code,
        name,
        price: Math.round(price * 100),
        category: kind,
        mealSlots: slots,
        emoji: p.emoji ?? { main: '🍔', side: '🍟', drink: '🥤', dessert: '🍦' }[kind],
        tags: [
          ...(group?.tags ?? []),
          ...(/辣/.test(name) ? ['辣'] : []),
          ...(p.canWithOrder ? ['价格含随单购条件，显示原价'] : []),
        ],
        source,
        nutritionMatched: kcal !== undefined && protein !== undefined,
        ...(kcal !== undefined ? { kcal } : {}),
        ...(protein !== undefined ? { protein } : {}),
      } as MenuProduct,
    ];
  });
}
export function normalizeEvents(raw: any): { date: string; title: string; description: string }[] {
  const plain = (value: unknown) =>
    String(value)
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  const d = businessData(raw);
  return (d?.dailyList ?? []).flatMap((day: any) =>
    (day.events ?? []).map((e: any) => ({
      date: String(day.date),
      title: plain(e.activityTitle || e.articleDto?.title || '官方活动'),
      description: plain(e.activitySubTitle || e.articleDto?.content || '以官方活动详情为准'),
    })),
  );
}
export function normalizePrice(raw: any): {
  price: number;
  originalPrice: number;
  discount: number;
  fees: number;
  takeWays: { code: string; title: string }[];
} {
  const d = businessData(raw),
    price = num(d?.price);
  if (price === undefined || price < 0 || !Number.isInteger(price))
    throw new Error('官方报价缺少有效的分单位金额');
  const money = (value: any) => {
    const v = num(value) ?? 0;
    if (v < 0 || !Number.isInteger(v)) throw new Error('官方费用不是有效的分单位金额');
    return v;
  };
  return {
    price,
    originalPrice: money(d.originalPrice ?? price),
    discount: money(d.discount),
    fees: money(d.deliveryPrice) + money(d.packingPrice) + money(d.tablewarePrice),
    takeWays: (d.takeWayList ?? [])
      .filter((t: any) => t.code !== undefined)
      .map((t: any) => ({ code: String(t.code), title: String(t.title ?? '取餐方式') })),
  };
}
