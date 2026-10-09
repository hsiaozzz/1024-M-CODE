export type MealSlot = 'breakfast' | 'lunch' | 'dinner';
export type Category = 'main' | 'side' | 'drink' | 'dessert';
export type Mode = 'demo' | 'live';
export interface Profile {
  id: string;
  name: string;
  city: string;
  location: string;
  budgets: Record<MealSlot, number>;
  preferences: string[];
  calorieTarget: number;
  proteinTarget: number;
}
export interface Mission {
  id: string;
  date: string;
  slot: MealSlot;
  title: string;
  story: string;
  budget: number;
  people: number;
  requiredCategories: Category[];
  minProtein: number;
  maxCalories: number;
  objective: 'savings' | 'protein' | 'variety';
  bonus: string;
  seed: string;
  status: 'available' | 'complete';
  reward: number;
  window: string;
  preferences?: string[];
}
export interface Store {
  storeCode: string;
  storeName: string;
  address: string;
  distance: number;
  beCode?: string;
  businessStatus: boolean;
  beType?: 1 | 2 | 5 | 6;
}
export interface MenuProduct {
  code: string;
  name: string;
  price: number;
  category: Category;
  kcal?: number;
  protein?: number;
  tags: string[];
  mealSlots: MealSlot[];
  emoji: string;
  source: Mode;
  nutritionMatched: boolean;
}
export interface CartItem {
  productCode: string;
  quantity: number;
  couponId?: string;
  couponCode?: string;
  roundList?: unknown[];
  modification?: { values?: { code?: string; key?: string; quantity?: number }[] };
}
export interface Evaluation {
  passed: boolean;
  checks: { label: string; passed: boolean; detail: string }[];
  kcal: number | null;
  protein: number | null;
  coverage: number;
  score: number;
}
export interface Quote {
  id: string;
  price: number;
  originalPrice: number;
  discount: number;
  fees: number;
  items: CartItem[];
  source: Mode;
  store: Store;
  verifiedAt: string;
  evaluation: Evaluation;
  takeWays: { code: string; title: string }[];
}
export interface Solution {
  id: string;
  label: string;
  items: CartItem[];
  price: number;
  kcal: number | null;
  protein: number | null;
  coverage: number;
  score: number;
  explanation: string;
  officialVerified: boolean;
  quote?: Quote;
}
export interface Bootstrap {
  profile: Profile;
  missions: Mission[];
  date: string;
  stats: { xp: number; completed: number; streak: number; badges: string[] };
  connection: { mode: Mode; label: string; toolCount: number };
}
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  scene: string;
  write: boolean;
}
