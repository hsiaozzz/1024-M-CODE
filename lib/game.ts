import { createHash } from 'node:crypto';
import type {
  Profile,
  Mission,
  MealSlot,
  MenuProduct,
  CartItem,
  Evaluation,
  Solution,
} from './types';

export const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
export const SLOT_LABELS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
export function chinaDate(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function hash(input: string) {
  return createHash('sha256').update(input).digest('hex');
}
function random(seed: string) {
  let n = parseInt(hash(seed).slice(0, 8), 16);
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
export function defaultProfile(id: string): Profile {
  const names = ['橘子特工', '薯条侦探', '芝士工程师', '夜航队长', '麦麦冒险家'];
  const index = parseInt(hash(id).slice(0, 6), 16) % names.length;
  return {
    id,
    name: names[index],
    city: '成都市',
    location: '武侯区世外桃源酒店',
    budgets: { breakfast: 2200, lunch: 3500, dinner: 4200 },
    preferences: ['丰富搭配'],
    calorieTarget: 900,
    proteinTarget: 20,
  };
}
export function generateMission(profile: Profile, date: string, slot: MealSlot): Mission {
  const seed = hash(`${profile.id}:${date}:${slot}`).slice(0, 16);
  const rng = random(seed);
  const stories: Record<MealSlot, [string, string][]> = {
    breakfast: [
      ['唤醒城市的第一口', '清晨的补给站刚亮灯。为今天的冒险装上一份主食和饮料。'],
      ['早班特工补给', '第一班列车即将出发。用一份早餐把自己从睡意中拯救出来。'],
      ['晨光能量计划', '今天的灵感需要一顿好早餐。配好装备，再去迎接新任务。'],
      ['日出前的小远征', '把有限预算变成早晨的仪式感，给今天一个漂亮的开局。'],
    ],
    lunch: [
      ['午间灵感补给', '代码写到一半，午餐信号响了。寻找预算与口味之间的好解法。'],
      ['城市中场休息', '暂停忙碌，在主食与饮料之外寻找自己的午间搭配。'],
      ['正午省钱行动', '破解预算限制，用巧妙的组合给午后留下更多余量。'],
      ['午后能量补满', '距离今天的终点还有一半。用一份满意的午餐为自己续航。'],
    ],
    dinner: [
      ['夜航补给行动', '城市灯光正在亮起。准备晚餐，为今天的旅程写一个满意的结尾。'],
      ['落日收藏计划', '今天还有一道挑战。搭配一份属于你的晚间补给。'],
      ['晚班特别任务', '灵感在夜色里继续。找出满足预算和偏好的晚餐方案。'],
      ['城市收工仪式', '把晚餐当成一天的小奖励。用选择与搭配完成最后一场任务。'],
    ],
  };
  const [title, story] = stories[slot][Math.floor(rng() * stories[slot].length)];
  const randomObjective = (['savings', 'protein', 'variety'] as const)[Math.floor(rng() * 3)];
  const objective = profile.preferences.includes('蛋白优先')
    ? 'protein'
    : profile.preferences.includes('只想省钱')
      ? 'savings'
      : profile.preferences.includes('多样搭配')
        ? 'variety'
        : randomObjective;
  // Personalized variation stays below the user's stated spending cap.
  const budget = Math.min(
    profile.budgets[slot],
    Math.max(500, profile.budgets[slot] - Math.floor(rng() * 3) * 100),
  );
  const minProtein =
    objective === 'protein' ? Math.min(profile.proteinTarget, slot === 'breakfast' ? 16 : 22) : 0;
  return {
    id: hash(`${profile.id}:${date}:${slot}`).slice(0, 32),
    date,
    slot,
    title,
    story,
    budget,
    people: 1,
    requiredCategories: ['main', 'drink'],
    minProtein,
    maxCalories: profile.calorieTarget,
    objective,
    bonus:
      objective === 'savings'
        ? '在预算内留下更多余额'
        : objective === 'protein'
          ? `蛋白质至少 ${minProtein}g`
          : '探索更多不同品类',
    seed,
    status: 'available',
    reward: 80 + Math.floor(rng() * 5) * 10,
    preferences: [...profile.preferences],
    window: { breakfast: '05:00–10:30', lunch: '10:30–16:00', dinner: '16:00–23:59' }[slot],
  };
}
export function cartTotals(items: CartItem[], products: MenuProduct[]) {
  const map = new Map(products.map((p) => [p.code, p]));
  let price = 0,
    kcal = 0,
    protein = 0,
    known = 0,
    count = 0;
  const categories = new Set<string>();
  for (const item of items) {
    const product = map.get(item.productCode);
    if (!product) throw new Error('餐品已不在当前门店菜单中，请重新选择');
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)
      throw new Error('餐品数量应为1至20的整数');
    price += product.price * item.quantity;
    count += item.quantity;
    categories.add(product.category);
    if (
      product.nutritionMatched &&
      product.kcal !== undefined &&
      product.protein !== undefined &&
      !item.modification &&
      !item.roundList
    ) {
      kcal += product.kcal * item.quantity;
      protein += product.protein * item.quantity;
      known += item.quantity;
    }
  }
  return {
    price,
    kcal: known === count && count > 0 ? kcal : null,
    protein: known === count && count > 0 ? protein : null,
    coverage: count ? known / count : 0,
    categories,
    count,
  };
}
export function evaluate(
  mission: Mission,
  items: CartItem[],
  products: MenuProduct[],
  verifiedPrice: number,
): Evaluation {
  if (!Number.isSafeInteger(verifiedPrice) || verifiedPrice < 0)
    throw new Error('报价必须是非负整数分');
  const totals = cartTotals(items, products);
  const slotMatch = items.every((i) =>
    products.find((p) => p.code === i.productCode)?.mealSlots.includes(mission.slot),
  );
  const checks = [
    {
      label: '预算',
      passed: verifiedPrice <= mission.budget,
      detail: `¥${(verifiedPrice / 100).toFixed(2)} / ¥${(mission.budget / 100).toFixed(2)}`,
    },
    {
      label: '主食＋饮料',
      passed: mission.requiredCategories.every((c) => totals.categories.has(c)),
      detail: '补给需要主食和饮料',
    },
    {
      label: '餐次匹配',
      passed: slotMatch,
      detail: slotMatch ? '符合本餐次的餐品' : '含其他餐次的餐品',
    },
    {
      label: '口味偏好',
      passed:
        !mission.preferences?.includes('不吃辣') ||
        items.every((i) => !products.find((p) => p.code === i.productCode)?.tags.includes('辣')),
      detail: mission.preferences?.includes('不吃辣') ? '遵守不吃辣偏好' : '按个人偏好自由搭配',
    },
    {
      label: '热量目标',
      passed: totals.kcal !== null && totals.kcal <= mission.maxCalories,
      detail:
        totals.kcal === null
          ? '部分餐品营养未知，暂不能核验'
          : `${totals.kcal} / ${mission.maxCalories} kcal`,
    },
    {
      label: '蛋白质目标',
      passed:
        mission.minProtein === 0 ||
        (totals.protein !== null && totals.protein >= mission.minProtein),
      detail:
        mission.minProtein === 0
          ? '本关没有额外蛋白质门槛'
          : totals.protein === null
            ? '部分餐品营养未知，暂不能核验'
            : `${totals.protein} / ${mission.minProtein} g`,
    },
  ];
  const passed = items.length > 0 && checks.every((c) => c.passed);
  const spare = Math.max(0, mission.budget - verifiedPrice) / Math.max(1, mission.budget);
  const score = passed
    ? Math.round(
        600 + spare * 200 + Math.min(totals.protein || 0, 40) * 2 + totals.categories.size * 20,
      )
    : Math.round((checks.filter((c) => c.passed).length / checks.length) * 400);
  return {
    passed,
    checks,
    kcal: totals.kcal,
    protein: totals.protein,
    coverage: totals.coverage,
    score,
  };
}
export function solveCandidates(
  mission: Mission,
  products: MenuProduct[],
): { solutions: Solution[]; searched: number } {
  const usable = products.filter(
    (p) =>
      p.mealSlots.includes(mission.slot) &&
      p.price > 0 &&
      p.nutritionMatched &&
      (!mission.preferences?.includes('不吃辣') || !p.tags.includes('辣')),
  );
  const mains = usable.filter((p) => p.category === 'main').slice(0, 35);
  const drinks = usable.filter((p) => p.category === 'drink').slice(0, 20);
  const sides = [
    undefined,
    ...usable.filter((p) => p.category === 'side' || p.category === 'dessert').slice(0, 20),
  ];
  const candidates: Solution[] = [];
  let searched = 0;
  for (const main of mains)
    for (const drink of drinks)
      for (const side of sides) {
        searched++;
        const combo = [main, drink, ...(side ? [side] : [])];
        const items = combo.map((p) => ({ productCode: p.code, quantity: 1 }));
        const totals = cartTotals(items, products);
        // Menu prices are a candidate estimate. A bounded shortlist is officially quoted later.
        if (
          totals.price > mission.budget * 1.35 ||
          totals.kcal === null ||
          totals.kcal > mission.maxCalories ||
          totals.protein === null ||
          totals.protein < mission.minProtein
        )
          continue;
        const e = evaluate(mission, items, products, totals.price);
        candidates.push({
          id: hash(items.map((i) => i.productCode).join(':')).slice(0, 12),
          label: '',
          items,
          price: totals.price,
          kcal: totals.kcal,
          protein: totals.protein,
          coverage: totals.coverage,
          score: e.score,
          explanation: combo.map((p) => p.name).join(' ＋ '),
          officialVerified: false,
        });
      }
  const chosen: Solution[] = [];
  const ranked = [
    { label: '省钱路线', compare: (a: Solution, b: Solution) => a.price - b.price },
    {
      label: '蛋白优先',
      compare: (a: Solution, b: Solution) =>
        (b.protein || 0) - (a.protein || 0) || a.price - b.price,
    },
    {
      label: '丰富搭配',
      compare: (a: Solution, b: Solution) => b.items.length - a.items.length || b.score - a.score,
    },
  ];
  for (const route of ranked) {
    const ordered = [...candidates].sort(route.compare);
    const candidate =
      ordered.find((c) => c.price <= mission.budget && !chosen.some((x) => x.id === c.id)) ||
      ordered.find((c) => !chosen.some((x) => x.id === c.id));
    if (candidate) chosen.push({ ...candidate, label: route.label });
  }
  return { solutions: chosen, searched };
}
