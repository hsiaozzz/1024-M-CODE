import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chinaDate,
  defaultProfile,
  generateMission,
  SLOTS,
  cartTotals,
  evaluate,
  solveCandidates,
} from '../lib/game';
import { DEMO_PRODUCTS } from '../lib/demo-tools';
import type { CartItem, MenuProduct, Mission } from '../lib/types';

const product = (code: string, overrides: Partial<MenuProduct> = {}): MenuProduct => ({
  code,
  name: code,
  price: 1200,
  category: 'main',
  kcal: 300,
  protein: 22,
  tags: [],
  mealSlots: ['lunch', 'dinner'],
  emoji: '🍔',
  source: 'demo',
  nutritionMatched: true,
  ...overrides,
});
const main = product('main');
const drink = product('drink', { category: 'drink', price: 300, kcal: 100, protein: 0 });
const mission = (overrides: Partial<Mission> = {}): Mission => ({
  ...generateMission(defaultProfile('game-test-player'), '2026-10-09', 'lunch'),
  budget: 3000,
  maxCalories: 700,
  minProtein: 20,
  ...overrides,
});
const basicCart: CartItem[] = [
  { productCode: 'main', quantity: 1 },
  { productCode: 'drink', quantity: 1 },
];

test('Beijing daily rollover happens at UTC 16:00, including year boundaries', () => {
  assert.equal(chinaDate(new Date('2026-10-09T15:59:59.999Z')), '2026-10-09');
  assert.equal(chinaDate(new Date('2026-10-09T16:00:00.000Z')), '2026-10-10');
  assert.equal(chinaDate(new Date('2026-12-31T16:00:00.000Z')), '2027-01-01');
});

test('one player receives three stable daily missions, one per meal', () => {
  const profile = defaultProfile('stable-player');
  const first = SLOTS.map((slot) => generateMission(profile, '2026-10-09', slot));
  const second = SLOTS.map((slot) => generateMission(structuredClone(profile), '2026-10-09', slot));
  assert.deepEqual(first, second, 'refreshing must not reroll the daily challenge');
  assert.deepEqual(
    first.map((m) => m.slot),
    ['breakfast', 'lunch', 'dinner'],
  );
  assert.equal(new Set(first.map((m) => m.id)).size, 3);
  assert.equal(new Set(first.map((m) => m.seed)).size, 3);
  for (const entry of first) {
    assert.ok(
      entry.budget <= profile.budgets[entry.slot],
      'quest budgets must respect the personal spending cap',
    );
    assert.ok(Number.isSafeInteger(entry.budget));
    assert.ok(entry.maxCalories <= profile.calorieTarget);
  }
});

test('player identity and date produce independent decks, with distinct mission identities in every slot', () => {
  const date = '2026-10-09';
  const a = SLOTS.map((slot) => generateMission(defaultProfile('alice'), date, slot));
  const b = SLOTS.map((slot) => generateMission(defaultProfile('bob'), date, slot));
  const next = SLOTS.map((slot) => generateMission(defaultProfile('alice'), '2026-10-10', slot));
  for (let i = 0; i < SLOTS.length; i++) {
    assert.notEqual(a[i].id, b[i].id);
    assert.notEqual(a[i].seed, b[i].seed);
    assert.notEqual(a[i].id, next[i].id);
    assert.notEqual(a[i].seed, next[i].seed);
  }
  const content = (deck: Mission[]) =>
    deck.map(({ title, budget, objective, reward }) => ({ title, budget, objective, reward }));
  assert.notDeepEqual(
    content(a),
    content(b),
    'different profiles should change the challenge, not just its identifier',
  );
  assert.notDeepEqual(content(a), content(next), 'a new day should generate a fresh challenge');
});

test('small personal spending caps stay binding and mission preferences are a snapshot', () => {
  const profile = defaultProfile('small-budget-player');
  profile.budgets = { breakfast: 500, lunch: 600, dinner: 900 };
  profile.preferences = ['不吃辣'];
  const deck = SLOTS.map((slot) => generateMission(profile, '2026-10-09', slot));
  profile.preferences.push('丰富搭配');
  for (const entry of deck) {
    assert.ok(entry.budget <= profile.budgets[entry.slot]);
    assert.deepEqual(
      entry.preferences,
      ['不吃辣'],
      'later profile changes must not mutate an existing daily quest',
    );
  }
});

test('a complete standard cart uses menu values, multiplied by quantity, in integer cents', () => {
  const result = cartTotals(
    [
      { productCode: 'main', quantity: 2 },
      { productCode: 'drink', quantity: 1 },
    ],
    [main, drink],
  );
  assert.equal(result.price, 2700);
  assert.equal(result.kcal, 700);
  assert.equal(result.protein, 44);
  assert.equal(result.coverage, 1);
  assert.equal(result.count, 3);
  assert.deepEqual([...result.categories].sort(), ['drink', 'main']);
});

test('official quotation controls budget eligibility; client supplied price and nutrition cannot lower totals', () => {
  const spoofedCart = basicCart.map((item) => ({
    ...item,
    price: 0,
    kcal: 0,
    protein: 999,
  })) as CartItem[];
  const within = evaluate(mission({ budget: 1500 }), spoofedCart, [main, drink], 1500);
  assert.equal(within.passed, true);
  assert.equal(within.kcal, 400);
  assert.equal(within.protein, 22);
  const over = evaluate(mission({ budget: 1500 }), spoofedCart, [main, drink], 1501);
  assert.equal(over.passed, false);
  assert.equal(over.checks.find((c) => c.label === '预算')?.passed, false);
  const discounted = evaluate(mission({ budget: 1400 }), basicCart, [main, drink], 1400);
  assert.equal(
    discounted.passed,
    true,
    'official discounts may bring a menu estimate under budget',
  );
});

test('invalid and excessive quantities or unknown products cannot earn completion', () => {
  for (const quantity of [0, -1, 1.5, 21, NaN, Infinity]) {
    assert.throws(
      () => evaluate(mission(), [{ productCode: 'main', quantity }], [main], 1000),
      /数量/,
    );
  }
  assert.throws(
    () => cartTotals([{ productCode: 'invented-cheap-burger', quantity: 1 }], [main]),
    /当前门店菜单/,
  );
  for (const price of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => evaluate(mission(), basicCart, [main, drink], price), /整数分/);
  }
});

test('unknown nutrition remains unknown and coverage counts portions rather than rows', () => {
  const unknown = product('unknown-drink', {
    category: 'drink',
    nutritionMatched: false,
    kcal: undefined,
    protein: undefined,
  });
  const cart = [
    { productCode: 'main', quantity: 3 },
    { productCode: 'unknown-drink', quantity: 1 },
  ];
  const totals = cartTotals(cart, [main, unknown]);
  assert.equal(totals.coverage, 0.75);
  assert.equal(totals.kcal, null);
  assert.equal(totals.protein, null);
  const result = evaluate(mission({ maxCalories: 2000 }), cart, [main, unknown], 2500);
  assert.equal(result.passed, false);
  assert.equal(result.checks.find((c) => c.label === '热量目标')?.passed, false);
  assert.equal(result.checks.find((c) => c.label === '蛋白质目标')?.passed, false);
});

test('partial nutrition and modified meals never masquerade as fully verified nutrition', () => {
  const partial = product('partial', { protein: undefined });
  assert.equal(cartTotals([{ productCode: 'partial', quantity: 1 }], [partial]).coverage, 0);
  for (const customized of [
    {
      productCode: 'main',
      quantity: 1,
      modification: { values: [{ code: 'remove-cheese', key: 'unselected', quantity: 0 }] },
    },
    { productCode: 'main', quantity: 1, roundList: [{ round: 'combo-1' }] },
  ]) {
    const result = evaluate(mission(), [customized, basicCart[1]], [main, drink], 1500);
    assert.equal(result.coverage, 0.5);
    assert.equal(result.kcal, null);
    assert.equal(result.protein, null);
    assert.equal(result.passed, false);
  }
});

test('meal timing, required categories and nutrition thresholds all gate completion', () => {
  assert.equal(evaluate(mission(), basicCart, [main, drink], 1500).passed, true);
  assert.equal(
    evaluate(mission({ slot: 'breakfast' }), basicCart, [main, drink], 1500).passed,
    false,
  );
  assert.equal(evaluate(mission({ minProtein: 23 }), basicCart, [main, drink], 1500).passed, false);
  assert.equal(
    evaluate(mission({ maxCalories: 399 }), basicCart, [main, drink], 1500).passed,
    false,
  );
  assert.equal(evaluate(mission(), [basicCart[0]], [main, drink], 1200).passed, false);
  assert.equal(evaluate(mission({ minProtein: 0 }), [], [main, drink], 0).passed, false);
});

test('candidate search finds distinct economical, protein and varied routes while excluding unusable meals', () => {
  const products = [
    main,
    drink,
    product('protein-main', { price: 2000, kcal: 400, protein: 35 }),
    product('small-side', { category: 'side', price: 500, kcal: 100, protein: 4 }),
    product('oversized-side', { category: 'side', price: 500, kcal: 900, protein: 4 }),
    product('unaffordable-main', { price: 5000 }),
    product('breakfast-only', { price: 100, mealSlots: ['breakfast'] }),
    product('unknown-main', { price: 100, nutritionMatched: false }),
    product('protein-poor', { price: 100, protein: 1 }),
  ];
  const result = solveCandidates(mission(), products);
  assert.equal(result.solutions.length, 3);
  assert.equal(new Set(result.solutions.map((s) => s.id)).size, 3);
  assert.deepEqual(result.solutions[0].items, basicCart);
  const protein = result.solutions.find((s) => s.label === '蛋白优先');
  assert.equal(protein?.protein, 39);
  assert.ok(protein?.items.some((i) => i.productCode === 'protein-main'));
  assert.equal(result.solutions.find((s) => s.label === '丰富搭配')?.items.length, 3);
  const excluded = new Set([
    'oversized-side',
    'unaffordable-main',
    'breakfast-only',
    'unknown-main',
    'protein-poor',
  ]);
  for (const solution of result.solutions) {
    assert.ok(solution.items.every((i) => !excluded.has(i.productCode)));
    assert.equal(solution.officialVerified, false, 'candidate estimates are not an official quote');
    assert.equal(solution.coverage, 1);
    assert.ok(solution.protein! >= 20);
    assert.ok(solution.kcal! <= 700);
  }
});

test('an infeasible menu yields an empty shortlist without inventing substitute meals', () => {
  const impossible = solveCandidates(mission(), [main]);
  assert.deepEqual(impossible.solutions, []);
  assert.equal(impossible.searched, 0);
});

test('the nonspicy preference filters candidate meals even when spicy meals are cheaper', () => {
  const spicy = product('cheap-spicy-main', { price: 100, tags: ['辣'] });
  const result = solveCandidates(mission({ preferences: ['不吃辣'] }), [spicy, main, drink]);
  assert.equal(result.solutions.length, 1);
  assert.deepEqual(result.solutions[0].items, basicCart);
  const handPicked = [{ productCode: spicy.code, quantity: 1 }, basicCart[1]];
  const resultWithSpice = evaluate(
    mission({ preferences: ['不吃辣'] }),
    handPicked,
    [spicy, main, drink],
    400,
  );
  assert.equal(
    resultWithSpice.passed,
    false,
    'manually selected spicy food must obey the same preference',
  );
  assert.equal(resultWithSpice.checks.find((c) => c.label === '口味偏好')?.passed, false);
});

test('all three default demo meals are solvable for 100 independent player identities', () => {
  const products: MenuProduct[] = DEMO_PRODUCTS.map(({ cents, ...entry }) => ({
    ...entry,
    price: cents,
    source: 'demo',
    nutritionMatched: true,
    tags: [],
  }));
  for (let player = 0; player < 100; player++) {
    const profile = defaultProfile(`demo-solvable-player-${player}`);
    for (const slot of SLOTS) {
      const daily = generateMission(profile, '2026-10-09', slot);
      const { solutions } = solveCandidates(daily, products);
      assert.ok(
        solutions.some(
          (solution) => evaluate(daily, solution.items, products, solution.price).passed,
        ),
        `player ${player} ${slot} must have a feasible default route`,
      );
    }
  }
});

test('explicit savings, protein and variety preferences select the corresponding objective', () => {
  for (const [preference, objective] of [
    ['只想省钱', 'savings'],
    ['蛋白优先', 'protein'],
    ['多样搭配', 'variety'],
  ] as const) {
    const profile = { ...defaultProfile('objective-player'), preferences: [preference] };
    for (const slot of SLOTS)
      assert.equal(generateMission(profile, '2026-10-09', slot).objective, objective);
  }
});
