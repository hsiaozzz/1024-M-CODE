'use client';

import { use, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Backpack,
  Check,
  Copy,
  Flag,
  Flame,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  CartItem,
  Category,
  Evaluation,
  MenuProduct,
  Mission,
  Mode,
  Solution,
} from '@/lib/types';
import { CityIllustration } from '@/components/CityIllustration';

type SharedChallenge = {
  code: string;
  mission: Mission;
  products: MenuProduct[];
  source: Mode;
  baseline: Solution | null;
};
type ChallengeResult = {
  price: number;
  evaluation: Evaluation;
  baseline: Solution | null;
  beatAI: boolean;
};
const money = (cents: number) => `¥${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
const categories: Record<Category, string> = {
  main: '主食',
  side: '小食',
  drink: '饮品',
  dessert: '甜品',
};
const slots = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
async function api<T>(path: string, body?: unknown): Promise<T> {
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
  if (!response.ok) throw new Error(data.error || '挑战信号暂时中断，请稍后重试。');
  return data as T;
}

export default function ChallengePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [challenge, setChallenge] = useState<SharedChallenge>();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [result, setResult] = useState<ChallengeResult>();
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    api<SharedChallenge>(`/api/game/shared?code=${encodeURIComponent(code)}`)
      .then((next) => {
        if (alive) setChallenge(next);
      })
      .catch((error) => {
        if (alive) setError(error instanceof Error ? error.message : '挑战卡无法打开。');
      });
    return () => {
      alive = false;
    };
  }, [code]);
  function add(productCode: string, delta: number) {
    setCart((previous) => {
      const found = previous.find((item) => item.productCode === productCode);
      if (!found) return delta > 0 ? [...previous, { productCode, quantity: 1 }] : previous;
      return previous
        .map((item) =>
          item.productCode === productCode
            ? { ...item, quantity: Math.min(20, Math.max(0, item.quantity + delta)) }
            : item,
        )
        .filter((item) => item.quantity > 0);
    });
    setResult(undefined);
    setError('');
  }
  async function evaluate() {
    setBusy(true);
    setError('');
    try {
      setResult(await api<ChallengeResult>('/api/game/shared/evaluate', { code, items: cart }));
    } catch (error) {
      setError(error instanceof Error ? error.message : '挑战结算失败。');
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `来麦麦补给局和我比一场配餐！\n${window.location.href}\n免费冻结卡组挑战，无需下单。`,
      );
      setCopied(true);
    } catch {
      setError('当前浏览器无法复制，请从地址栏分享这个页面链接。');
    }
  }
  if (!challenge)
    return (
      <main className="loading-screen">
        <div className="brand-mark">
          m<span>↗</span>
        </div>
        <h1>好友补给挑战</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <a href="/" className="button button-orange">
              回到补给局 <ArrowRight size={16} />
            </a>
          </>
        ) : (
          <>
            <div className="loading-bar" />
            <p>正在展开这份挑战卡…</p>
          </>
        )}
      </main>
    );
  const { mission, products, baseline } = challenge;
  const total = cart.reduce(
    (sum, item) =>
      sum +
      (products.find((product) => product.code === item.productCode)?.price || 0) * item.quantity,
    0,
  );
  const available = products.filter(
    (product) =>
      product.mealSlots.includes(mission.slot) &&
      (category === 'all' || product.category === category),
  );
  const ai = result?.baseline || baseline;

  return (
    <div className="challenge-shell">
      <header className="challenge-topbar">
        <a href="/" className="brand">
          <div className="brand-mark">
            m<span>↗</span>
          </div>
          <div>
            <strong>麦麦补给局</strong>
            <small>MAKE EVERY MEAL A QUEST.</small>
          </div>
        </a>
        <a href="/" className="text-button">
          <ArrowLeft size={15} />
          回到我的冒险
        </a>
      </header>
      <main className="challenge-main">
        <section className="challenge-hero">
          <div className="challenge-hero-copy">
            <span className="eyebrow">
              <Swords size={14} /> CHALLENGE ACCEPTED?
            </span>
            <h1>
              同一份卡组，
              <br />
              <span>试试你的解法。</span>
            </h1>
            <p>
              朋友给你留下一场 {slots[mission.slot]} 补给挑战。
              <br />
              满足所有目标，再和 AI 比一比搭配分数。
            </p>
            <div className="challenge-code">
              <Flag size={13} />
              挑战 #{challenge.code}
              <span className={`source-label ${challenge.source}`}>
                {challenge.source === 'demo' ? '演示卡组快照' : '实时卡组快照'}
              </span>
            </div>
          </div>
          <div className="challenge-city">
            <CityIllustration />
          </div>
        </section>
        <div className="challenge-notice">
          <span className="challenge-notice-icon">
            <Sparkles size={17} />
          </span>
          <p>
            <strong>免费玩，无需账户连接或下单。</strong>
            这是一份冻结价格的模拟挑战，所有人使用同一份卡组。当前官方价格与权益可能变化；挑战不消耗积分、不创建真实订单，也不奖励
            XP。
          </p>
        </div>
        <section className="challenge-game">
          <div className="challenge-game-header">
            <div>
              <span className="eyebrow">YOUR FRIEND’S MISSION</span>
              <h2>{mission.title}</h2>
              <p>{mission.story}</p>
            </div>
            <button className="button button-small button-outline" onClick={() => void copy()}>
              {copied ? <Check size={14} /> : <Copy size={14} />}{' '}
              {copied ? '链接已复制' : '邀请另一位朋友'}
            </button>
          </div>
          <div className="builder-objectives">
            <span>
              <Wallet size={15} />
              不超过 {money(mission.budget)}
            </span>
            <span>
              <Users size={15} />
              {mission.people} 人补给
            </span>
            <span>
              <Target size={15} />
              {mission.requiredCategories.map((item) => categories[item]).join(' + ')}
            </span>
            {mission.minProtein > 0 && (
              <span>
                <Flame size={15} />
                蛋白质 ≥ {mission.minProtein} g
              </span>
            )}
            <span>能量 ≤ {mission.maxCalories} kcal</span>
          </div>
          <div className="builder-layout">
            <div className="builder-menu">
              <div className="menu-heading">
                <h3>相同起点，不同搭配</h3>
                <span className="muted small">拖入补给箱或点击加号</span>
              </div>
              <div className="category-tabs" role="group" aria-label="挑战餐品分类">
                {(['all', 'main', 'side', 'drink', 'dessert'] as const).map((item) => (
                  <button
                    key={item}
                    className={category === item ? 'selected' : ''}
                    onClick={() => setCategory(item)}
                  >
                    {item === 'all' ? '全部卡牌' : categories[item]}
                  </button>
                ))}
              </div>
              <div className="product-grid">
                {available.map((product) => {
                  const quantity =
                    cart.find((item) => item.productCode === product.code)?.quantity || 0;
                  return (
                    <article
                      className={`product-card ${quantity ? 'in-cart' : ''}`}
                      key={product.code}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('application/mc-product', product.code);
                        event.dataTransfer.effectAllowed = 'copy';
                      }}
                    >
                      <div className={`product-art category-${product.category}`}>
                        <span>{product.emoji}</span>
                        <span className="product-category">{categories[product.category]}</span>
                      </div>
                      <div className="product-details">
                        <h4>{product.name}</h4>
                        <p>
                          {product.nutritionMatched
                            ? `${product.kcal ?? '—'} kcal · ${product.protein ?? '—'}g 蛋白`
                            : '营养数据暂未匹配'}
                        </p>
                        <div className="product-bottom">
                          <strong>{money(product.price)}</strong>
                          {quantity ? (
                            <div className="quantity-control">
                              <button
                                aria-label={`减少${product.name}`}
                                onClick={() => add(product.code, -1)}
                              >
                                <Minus size={13} />
                              </button>
                              <span>{quantity}</span>
                              <button
                                aria-label={`增加${product.name}`}
                                onClick={() => add(product.code, 1)}
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          ) : (
                            <button
                              className="product-add"
                              aria-label={`添加${product.name}`}
                              onClick={() => add(product.code, 1)}
                            >
                              <Plus size={17} />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
                {!available.length && (
                  <div className="empty-state">
                    <Backpack size={32} />
                    <p>这个分类暂无卡牌，试试其他分类。</p>
                  </div>
                )}
              </div>
              <div className="baseline-card">
                <span className="baseline-icon">
                  <Sparkles size={23} />
                </span>
                <div>
                  <span className="eyebrow">AI’S STARTING HAND</span>
                  <h3>搭档先出一手</h3>
                  {ai ? (
                    <>
                      <p>{ai.explanation}</p>
                      <div className="baseline-metrics">
                        <span>{money(ai.price)}</span>
                        <strong>{ai.score} 分</strong>
                      </div>
                    </>
                  ) : (
                    <p>这份卡组还没有满足全部条件的 AI 基准方案。试着找到你自己的解法。</p>
                  )}
                </div>
              </div>
            </div>
            <aside
              className="cart-panel"
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes('application/mc-product')) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'copy';
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const productCode = event.dataTransfer.getData('application/mc-product');
                if (products.some((product) => product.code === productCode)) add(productCode, 1);
              }}
            >
              <div className="cart-heading">
                <div>
                  <span className="eyebrow">YOUR OWN SOLUTION</span>
                  <h3>你的挑战补给箱</h3>
                </div>
                <Backpack size={24} />
              </div>
              {cart.length ? (
                <div className="cart-items">
                  {cart.map((item) => {
                    const product = products.find((entry) => entry.code === item.productCode);
                    return (
                      <div key={item.productCode} className="cart-item">
                        <span className="cart-item-emoji">{product?.emoji || '🍔'}</span>
                        <div>
                          <strong>{product?.name || item.productCode}</strong>
                          <small>{money((product?.price || 0) * item.quantity)}</small>
                        </div>
                        <div className="quantity-control">
                          <button
                            aria-label={`减少${product?.name}`}
                            onClick={() => add(item.productCode, -1)}
                          >
                            <Minus size={12} />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            aria-label={`增加${product?.name}`}
                            onClick={() => add(item.productCode, 1)}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="cart-empty">
                  <span>🍟</span>
                  <strong>用一份好搭配，回应挑战</strong>
                  <p>相同价格，相同卡组。看看你的选择能多拿几分。</p>
                </div>
              )}
              <div className="cart-budget">
                <span>冻结餐品价格合计</span>
                <strong className={total > mission.budget ? 'over-budget' : ''}>
                  {money(total)}
                </strong>
                <div className="budget-track">
                  <span style={{ width: `${Math.min(100, (total / mission.budget) * 100)}%` }} />
                </div>
                <small>挑战预算 {money(mission.budget)} · 模拟价格</small>
              </div>
              <button
                className="button button-orange full-width"
                disabled={!cart.length || busy}
                onClick={() => void evaluate()}
              >
                {busy ? <LoaderCircle size={17} className="spin" /> : <Swords size={17} />}{' '}
                {busy ? '正在结算…' : '提交我的挑战'}
              </button>
              {error && (
                <div className="error-banner" role="alert">
                  {error}
                </div>
              )}
              {result && (
                <div className="challenge-result" aria-live="polite">
                  <div className={`challenge-verdict ${result.evaluation.passed ? 'passed' : ''}`}>
                    <Trophy size={31} />
                    <span className="eyebrow">YOUR RESULT</span>
                    <h3>
                      {result.beatAI
                        ? '漂亮！你的解法超过 AI'
                        : result.evaluation.passed
                          ? '目标达成，搭配漂亮！'
                          : '还差一点，试试另一种搭配'}
                    </h3>
                    <div className="challenge-score">
                      {result.evaluation.score}
                      <span>分</span>
                    </div>
                    {ai && (
                      <p>
                        AI 基准 {ai.score} 分 · {result.evaluation.score > ai.score ? '+' : ''}
                        {result.evaluation.score - ai.score} 分
                      </p>
                    )}
                  </div>
                  <div className="quote-evaluation">
                    {result.evaluation.checks.map((check, index) => (
                      <div
                        key={index}
                        className={`evaluation-check ${check.passed ? 'passed' : ''}`}
                      >
                        <span>{check.passed ? <Check size={13} /> : <Minus size={13} />}</span>
                        <div>
                          <strong>{check.label}</strong>
                          <small>{check.detail}</small>
                        </div>
                      </div>
                    ))}
                    <p>
                      营养数据覆盖率 {Math.round(result.evaluation.coverage * 100)}%<br />
                      能量{' '}
                      {result.evaluation.kcal === null
                        ? '未知'
                        : `${result.evaluation.kcal} kcal`}{' '}
                      · 蛋白质{' '}
                      {result.evaluation.protein === null
                        ? '未知'
                        : `${result.evaluation.protein.toFixed(1)}g`}
                    </p>
                  </div>
                  <button
                    className="button button-outline full-width"
                    onClick={() => {
                      setResult(undefined);
                      setCart([]);
                    }}
                  >
                    <RotateCcw size={15} />
                    再试一份解法
                  </button>
                </div>
              )}
              <p className="cart-footnote">
                同一冻结卡组，按相同约束和分数规则结算。好友挑战与真实交易、个人任务奖励相互独立。
              </p>
            </aside>
          </div>
        </section>
        <footer className="challenge-footer">
          <div className="footer-brand">
            m<span>↗</span> MAKE EVERY MEAL A QUEST.
          </div>
          <a href="/" className="button button-charcoal">
            我也想要专属三餐任务 <ArrowRight size={16} />
          </a>
        </footer>
      </main>
    </div>
  );
}
