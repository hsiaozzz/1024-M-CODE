'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Award,
  Backpack,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  Copy,
  Flame,
  Gift,
  Globe2,
  LoaderCircle,
  MapPin,
  Minus,
  Moon,
  Plus,
  Radio,
  Rocket,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Sunrise,
  Swords,
  Target,
  Trophy,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import type {
  Bootstrap,
  CartItem,
  Category,
  MenuProduct,
  Mission,
  Profile,
  Quote,
  Solution,
  Store,
} from '@/lib/types';
import { CityIllustration } from '@/components/CityIllustration';
import { Modal } from '@/components/Modal';
import { ScenePanel, scenes, type SceneId } from '@/components/ScenePanel';

type Obj = Record<string, unknown>;
type EventItem = { date: string; title: string; description: string };
const slotInfo = {
  breakfast: { name: '早安', meal: '早餐', english: 'MORNING RUN', icon: Sunrise, color: 'peach' },
  lunch: { name: '午间', meal: '午餐', english: 'MIDDAY QUEST', icon: Sun, color: 'yellow' },
  dinner: { name: '晚间', meal: '晚餐', english: 'NIGHT ADVENTURE', icon: Moon, color: 'sage' },
};
const categoryNames: Record<Category, string> = {
  main: '主食',
  side: '小食',
  drink: '饮品',
  dessert: '甜品',
};
const money = (cents: number) => `¥${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
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
  if (!response.ok) throw new Error(data.error || '补给信号暂时中断，请再试一次。');
  return data as T;
}
function asObject(value: unknown): Obj {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Obj) : {};
}

export default function Home() {
  const [data, setData] = useState<Bootstrap>();
  const [initialError, setInitialError] = useState('');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [modal, setModal] = useState<'profile' | 'connection' | 'achievements' | 'help' | null>(
    null,
  );
  const [scene, setScene] = useState<SceneId | null>(null);
  const [scenePreview, setScenePreview] = useState<Obj>();
  const [mission, setMission] = useState<Mission | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [store, setStore] = useState<Store>();
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [coupons, setCoupons] = useState<unknown[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [quote, setQuote] = useState<Quote>();
  const [busy, setBusy] = useState('');
  const [builderError, setBuilderError] = useState('');
  const [toast, setToast] = useState('');
  const [profileDraft, setProfileDraft] = useState<Profile>();
  const [token, setToken] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [takeWay, setTakeWay] = useState('');
  const [shared, setShared] = useState(false);

  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 5500);
    return () => clearTimeout(timeout);
  }, [toast]);
  async function load() {
    setInitialError('');
    try {
      const bootstrap = await api<Bootstrap>('/api/game/bootstrap');
      setData(bootstrap);
      setProfileDraft(bootstrap.profile);
      void api<{ events: EventItem[] }>('/api/game/events')
        .then((result) => setEvents(result.events))
        .catch(() => {});
    } catch (error) {
      setInitialError(error instanceof Error ? error.message : '无法加载补给城市。');
    }
  }
  async function persona() {
    setBusy('persona');
    setSettingsError('');
    try {
      const next = await api<Bootstrap>('/api/game/persona', {});
      setData(next);
      setProfileDraft(next.profile);
      setStore(undefined);
      setStores([]);
      setProducts([]);
      setCart([]);
      setQuote(undefined);
      setToast(`欢迎 ${next.profile.name}！这是专属于这个身份的三份任务。`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : '身份切换失败。');
    } finally {
      setBusy('');
    }
  }
  function openSettings(type: 'profile' | 'connection') {
    setSettingsError('');
    setProfileDraft(data?.profile);
    setModal(type);
  }
  async function saveProfile() {
    if (!profileDraft) return;
    setBusy('profile');
    setSettingsError('');
    try {
      const next = await api<Bootstrap>('/api/game/profile', profileDraft);
      setData(next);
      setModal(null);
      setToast('特工档案已保存，新偏好将用于明天的三份任务。');
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : '保存失败。');
    } finally {
      setBusy('');
    }
  }
  async function connection(disconnect = false) {
    setBusy('connection');
    setSettingsError('');
    try {
      await api(
        disconnect ? '/api/mcp/disconnect' : '/api/mcp/connect',
        disconnect ? {} : { token },
      );
      setToken('');
      await load();
      setModal(null);
      setMission(null);
      setQuote(undefined);
      setStore(undefined);
      setProducts([]);
      setToast(disconnect ? '已回到演示世界。' : '实时补给信号已连接，可以探索你的个人账户。');
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : '连接失败。');
    } finally {
      setBusy('');
    }
  }
  async function beginMission(next: Mission) {
    if (!data) return;
    setMission(next);
    setCart([]);
    setQuote(undefined);
    setSolutions([]);
    setProducts([]);
    setCoupons([]);
    setBuilderError('');
    setShared(false);
    setCategory('all');
    setBusy('stores');
    try {
      const response = await api<{ stores: Store[] }>(
        `/api/game/stores?city=${encodeURIComponent(data.profile.city)}&keyword=${encodeURIComponent(data.profile.location)}&beType=1`,
      );
      setStores(response.stores);
      const first = response.stores.find((item) => item.businessStatus) || response.stores[0];
      if (first) {
        setStore(first);
        await loadMenu(first);
      } else {
        setStore(undefined);
        setBuilderError('这个位置还没有找到补给站，请在特工档案里换个出发位置。');
      }
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : '无法找到附近补给站。');
    } finally {
      setBusy('');
    }
  }
  async function loadMenu(next: Store) {
    setBusy('menu');
    setBuilderError('');
    setStore(next);
    setCart([]);
    setQuote(undefined);
    setSolutions([]);
    try {
      const result = await api<{ products: MenuProduct[]; coupons: unknown[] }>('/api/game/menu', {
        store: next,
      });
      setProducts(result.products);
      setCoupons(result.coupons);
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : '菜单暂时没有到达。');
    } finally {
      setBusy('');
    }
  }
  function changeCart(code: string, delta: number) {
    setCart((previous) => {
      const current = previous.find((item) => item.productCode === code);
      if (!current)
        return delta > 0
          ? [...previous, { productCode: code, quantity: Math.min(20, delta) }]
          : previous;
      return previous
        .map((item) =>
          item.productCode === code
            ? { ...item, quantity: Math.min(20, Math.max(0, item.quantity + delta)) }
            : item,
        )
        .filter((item) => item.quantity > 0);
    });
    setQuote(undefined);
    setShared(false);
    setBuilderError('');
  }
  function applyCoupon(value: unknown) {
    const coupon = asObject(value);
    const codes = (Array.isArray(coupon.products) ? coupon.products : []).map((item) =>
      String(asObject(item).productCode),
    );
    const eligible = cart.find((item) => !codes.length || codes.includes(item.productCode));
    if (!eligible) {
      setBuilderError('先添加这张券适用的餐品，再装配优惠卡。');
      return;
    }
    setCart((previous) =>
      previous.map((item) => ({
        ...item,
        couponId: item.productCode === eligible.productCode ? String(coupon.couponId) : undefined,
        couponCode:
          item.productCode === eligible.productCode ? String(coupon.couponCode) : undefined,
      })),
    );
    setQuote(undefined);
    setToast('优惠卡已装配，验价时会由补给服务核实是否适用。');
  }
  async function solve() {
    if (!mission || !store) return;
    setBusy('solve');
    setBuilderError('');
    try {
      const result = await api<{ solutions: Solution[]; searched: number }>('/api/game/solve', {
        missionId: mission.id,
        store,
      });
      setSolutions(result.solutions);
      if (!result.solutions.length)
        setBuilderError('当前菜单没有找到满足全部目标的方案。你仍可自由搭配，或试试另一家补给站。');
      else
        setToast(
          `已搜索 ${result.searched} 个候选，为你找到 ${result.solutions.length} 条补给路线。`,
        );
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : '方案搜索暂时失败。');
    } finally {
      setBusy('');
    }
  }
  function chooseSolution(solution: Solution) {
    setCart(solution.items);
    setQuote(solution.quote);
    setTakeWay(solution.quote?.takeWays[0]?.code || '');
    setBuilderError('');
    setShared(false);
  }
  async function verify() {
    if (!mission || !store || !cart.length) return;
    setBusy('quote');
    setBuilderError('');
    try {
      const next = await api<Quote>('/api/game/quote', {
        missionId: mission.id,
        store,
        items: cart,
      });
      setQuote(next);
      setTakeWay(next.takeWays[0]?.code || '');
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : '补给服务未能完成验价。');
    } finally {
      setBusy('');
    }
  }
  async function complete() {
    if (!quote || !mission) return;
    setBusy('complete');
    setBuilderError('');
    try {
      const response = await api<{ bootstrap: Bootstrap; reward: number }>('/api/game/complete', {
        missionId: mission.id,
        quoteId: quote.id,
      });
      setData(response.bootstrap);
      setMission(response.bootstrap.missions.find((item) => item.id === mission.id) || mission);
      setToast(`任务完成！获得 ${response.reward} XP。这个成就属于你，不需要购买餐品。`);
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : '任务结算失败。');
    } finally {
      setBusy('');
    }
  }
  async function checkout() {
    if (!quote) return;
    setBusy('checkout');
    setBuilderError('');
    try {
      const preview = await api<Obj>('/api/game/checkout', {
        quoteId: quote.id,
        takeWayCode: takeWay,
      });
      setScenePreview(preview);
      setScene('orders');
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : '订单预览失败。');
    } finally {
      setBusy('');
    }
  }
  async function share() {
    if (!mission) return;
    setBusy('share');
    try {
      const snapshot = await api<Obj>(
        `/api/game/challenge?missionId=${encodeURIComponent(mission.id)}`,
      );
      const link = new URL(String(snapshot.shareUrl), window.location.origin).href;
      const text = `麦麦补给局 · ${mission.title}\n${mission.date} ${slotInfo[mission.slot].meal}挑战\n预算 ${money(mission.budget)} / ${mission.people} 人\n${mission.story}\n\n来试试，你的配餐能超过 AI 吗？\n${link}\n冻结卡组的免费模拟挑战，无需下单。`;
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        setShared(true);
        setToast('挑战链接已复制，朋友打开就能玩同一份卡组。');
      } else {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const download = document.createElement('a');
        download.href = url;
        download.download = `麦麦挑战-${mission.date}-${mission.slot}.txt`;
        download.click();
        URL.revokeObjectURL(url);
        setToast('带有挑战链接的邀请卡已下载。');
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : '挑战卡暂时无法生成。');
    } finally {
      setBusy('');
    }
  }
  function openScene(next: SceneId) {
    setScenePreview(undefined);
    setScene(next);
  }

  if (!data)
    return (
      <main className="loading-screen">
        <div className="brand-mark">
          m<span>↗</span>
        </div>
        <h1>麦麦补给局</h1>
        {initialError ? (
          <>
            <p role="alert">{initialError}</p>
            <button className="button button-orange" onClick={() => void load()}>
              重新连接补给城市
            </button>
          </>
        ) : (
          <>
            <div className="loading-bar" />
            <p>正在准备今天的三次冒险…</p>
          </>
        )}
      </main>
    );
  const completed = data.missions.filter((item) => item.status === 'complete').length;
  const allDone = completed === 3;
  const todayLabel = new Date(`${data.date}T12:00:00+08:00`).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'Asia/Shanghai',
  });
  const total = cart.reduce(
    (sum, item) =>
      sum +
      (products.find((product) => product.code === item.productCode)?.price || 0) * item.quantity,
    0,
  );
  const availableProducts = products.filter(
    (product) =>
      (!mission || product.mealSlots.includes(mission.slot)) &&
      (category === 'all' || product.category === category),
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#today" className="brand" aria-label="麦麦补给局首页">
          <div className="brand-mark">
            m<span>↗</span>
          </div>
          <div>
            <strong>麦麦补给局</strong>
            <small>MAKE EVERY MEAL A QUEST.</small>
          </div>
        </a>
        <div className="sidebar-section-label">你的冒险地图</div>
        <nav className="main-nav" aria-label="主导航">
          <a href="#today" className="nav-item active">
            <Compass size={20} />
            今日任务<span className="nav-count">3</span>
          </a>
          <a href="#city-events" className="nav-item">
            <Globe2 size={20} />
            城市探索
          </a>
          <button className="nav-item" onClick={() => openScene('coupons')}>
            <Backpack size={20} />
            特工券包
          </button>
          <button className="nav-item" onClick={() => openScene('points')}>
            <Gift size={20} />
            积分收藏
          </button>
          <button className="nav-item" onClick={() => openScene('team')}>
            <Users size={20} />
            小队补给
          </button>
          <button className="nav-item" onClick={() => setModal('achievements')}>
            <Trophy size={20} />
            我的成就
          </button>
        </nav>
        <div className="sidebar-pass">
          <div className="pass-icon">
            <Rocket size={23} />
          </div>
          <strong>免费出发，快乐通关</strong>
          <p>任务、经验与徽章属于补给局。每一场冒险都无需消费。</p>
          <button className="text-button" onClick={() => setModal('help')}>
            了解玩法 <ArrowRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => openSettings('connection')}>
            <Radio size={18} />
            补给信号
            <span className={`status-dot ${data.connection.mode}`} />
          </button>
          <button className="nav-item" onClick={() => openSettings('profile')}>
            <Settings2 size={18} />
            特工档案
          </button>
          <p>
            独立创意作品 · 非官方应用
            <br />
            时区 Asia/Shanghai
          </p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-path">
            <span>补给局</span>
            <ChevronRight size={13} />
            <strong>今日任务</strong>
          </div>
          <div className="topbar-actions">
            <button
              className={`connection-pill ${data.connection.mode}`}
              onClick={() => openSettings('connection')}
            >
              <span className={`status-dot ${data.connection.mode}`} />
              {data.connection.mode === 'demo' ? '演示世界' : '实时世界'}
              <ChevronDown size={13} />
            </button>
            <button className="profile-button" onClick={() => openSettings('profile')}>
              <span className="avatar">{data.profile.name.slice(0, 1)}</span>
              <strong>{data.profile.name}</strong>
            </button>
          </div>
        </header>
        <main id="today" className="dashboard">
          <div className="greeting-row">
            <p>
              <span className="online-dot" /> {todayLabel}{' '}
              <span className="greeting-divider">/</span> 今天也有好事发生
            </p>
            <button
              className="text-button persona-switch"
              disabled={!!busy || data.connection.mode === 'live'}
              title={
                data.connection.mode === 'live'
                  ? '回到演示世界后可体验其他身份'
                  : '切换到一位新的演示特工'
              }
              onClick={() => void persona()}
            >
              <Users size={15} />
              {busy === 'persona' ? '准备新身份…' : '体验另一位特工'}
              <ArrowRight size={14} />
            </button>
          </div>
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow hero-eyebrow">
                <span /> DAILY SUPPLY ADVENTURES
              </span>
              <h1>
                今天，吃点
                <br />
                <span>有意思的。</span>
                <span className="hero-sparkle">✳</span>
              </h1>
              <p>
                一座城市，三次冒险。
                <br />
                用你的预算和口味，解锁专属于你的补给路线。
              </p>
              <div className="hero-location">
                <MapPin size={16} />
                <span>
                  {data.profile.city} · {data.profile.location}
                </span>
                <button aria-label="修改出发位置" onClick={() => openSettings('profile')}>
                  <Settings2 size={14} />
                </button>
              </div>
              <a className="button button-charcoal hero-cta" href="#daily-missions">
                开启今日冒险 <ArrowDown size={17} />
              </a>
            </div>
            <div className="hero-art">
              <div className="city-orbit orbit-one" />
              <div className="city-orbit orbit-two" />
              <CityIllustration />
              <div className="art-caption">
                <span className="tiny-mark">✦</span> 你的城市，正在准备下一次补给{' '}
                <span>01 / 03</span>
              </div>
            </div>
          </section>
          <section className="progress-strip" aria-label="今日冒险进度">
            <div className="progress-title">
              <span className="progress-symbol">
                <Zap size={19} />
              </span>
              <div>
                <strong>{allDone ? '今日三餐，全部通关！' : '今天的三次小冒险'}</strong>
                <small>
                  {allDone
                    ? '明天见，新任务会为你准时出现。'
                    : '早、中、晚各一份，每个人都不一样。'}
                </small>
              </div>
            </div>
            <div className="progress-slots">
              {data.missions.map((item) => {
                const Icon = slotInfo[item.slot].icon;
                return (
                  <div
                    key={item.id}
                    className={`progress-slot ${item.status === 'complete' ? 'done' : ''}`}
                  >
                    <span>
                      {item.status === 'complete' ? <Check size={16} /> : <Icon size={16} />}
                    </span>
                    <small>{slotInfo[item.slot].meal}</small>
                  </div>
                );
              })}
            </div>
            <div className="progress-number">
              <b>{completed}</b>
              <span>/ 3 完成</span>
            </div>
          </section>
          <section id="daily-missions" className="missions-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">TODAY’S QUESTS</span>
                <h2>
                  今日专属任务 <span className="heading-count">03</span>
                </h2>
              </div>
              <span className="personal-label">
                <Sparkles size={14} />
                根据你的特工档案生成
              </span>
            </div>
            <div className="mission-grid">
              {data.missions.map((item, index) => {
                const info = slotInfo[item.slot],
                  Icon = info.icon;
                return (
                  <article
                    key={item.id}
                    className={`mission-card ${info.color} ${item.status === 'complete' ? 'mission-complete' : ''}`}
                  >
                    <div className="mission-card-top">
                      <span className="mission-time">
                        <Icon size={16} />
                        {info.name} · {item.window}
                      </span>
                      <span className="mission-index">0{index + 1}</span>
                    </div>
                    <div className="mission-symbol">
                      <Icon size={37} strokeWidth={1.45} />
                      <span>✦</span>
                    </div>
                    <span className="mission-english">{info.english}</span>
                    <h3>{item.title}</h3>
                    <p className="mission-story">{item.story}</p>
                    <div className="mission-meta">
                      <span>
                        <Wallet size={14} />
                        {money(item.budget)} 预算
                      </span>
                      <span>
                        <Users size={14} />
                        {item.people} 人补给
                      </span>
                    </div>
                    <div className="mission-card-bottom">
                      <span className="xp-reward">
                        <Zap size={13} />+{item.reward} XP
                      </span>
                      <button
                        className={`button button-small ${item.status === 'complete' ? 'button-outline' : 'button-charcoal'}`}
                        disabled={!!busy}
                        onClick={() => void beginMission(item)}
                      >
                        {item.status === 'complete' ? (
                          <>
                            <CheckCheck size={16} />
                            已通关 · 查看
                          </>
                        ) : (
                          <>
                            接受任务 <ArrowRight size={16} />
                          </>
                        )}
                      </button>
                    </div>
                    <div className="mission-fingerprint">
                      PERSONAL QUEST #{item.seed.slice(-7).toUpperCase()}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="city-section" id="city-events">
            <div className="section-heading">
              <div>
                <span className="eyebrow">BEYOND THE EVERYDAY</span>
                <h2>城市里，还有新故事</h2>
              </div>
              <button className="text-button" onClick={() => openScene('events')}>
                打开情报台 <ArrowRight size={15} />
              </button>
            </div>
            <div className="city-feature-grid">
              <button className="event-feature" onClick={() => openScene('party')}>
                <div className="feature-badge">城市限时事件</div>
                <h3>
                  下一次见面，
                  <br />
                  给生活加点惊喜。
                </h3>
                <p>发现主题派对、品鉴会和麦麦体验营。</p>
                <span className="feature-link">
                  探索城市活动 <ArrowRight size={16} />
                </span>
                <div className="feature-illustration" aria-hidden="true">
                  <div className="gift-box">
                    <i />
                    <i />
                    <span>✦</span>
                  </div>
                  <span className="floating-star">✧</span>
                  <span className="floating-star second">✶</span>
                </div>
              </button>
              <div className="event-list">
                <div className="event-list-header">
                  <span className={`source-label ${data.connection.mode}`}>
                    {data.connection.mode === 'demo' ? '演示活动' : '当月活动'}
                  </span>
                  <Globe2 size={18} />
                </div>
                {events.length ? (
                  events.slice(0, 3).map((event, index) => (
                    <button
                      className="event-row"
                      key={`${event.date}-${index}`}
                      onClick={() => openScene('events')}
                    >
                      <span className="event-date">{event.date.slice(5).replace('-', '/')}</span>
                      <div>
                        <strong>{event.title}</strong>
                        <p>{event.description}</p>
                      </div>
                      <ChevronRight size={17} />
                    </button>
                  ))
                ) : (
                  <div className="empty-state compact">
                    <p>去情报台看看这个月发生了什么。</p>
                    <button className="text-button" onClick={() => openScene('events')}>
                      查阅活动 <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
              <button className="achievement-feature" onClick={() => setModal('achievements')}>
                <div className="achievement-orbit">
                  <Award size={51} strokeWidth={1.4} />
                  <span>✦</span>
                </div>
                <span className="eyebrow">YOUR PROGRESS</span>
                <h3>
                  {data.stats.xp} <span>XP</span>
                </h3>
                <p>每一份用心搭配，都值得一枚徽章。</p>
                <span className="feature-link">
                  查看我的成长 <ArrowRight size={15} />
                </span>
              </button>
            </div>
          </section>
          <section className="destinations-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">YOUR NEXT STOP</span>
                <h2>挑一站，继续探索</h2>
              </div>
              <span className="muted small">所有补给能力，都有自己的去处。</span>
            </div>
            <div className="destination-grid">
              {(
                [
                  'coupons',
                  'lab',
                  'points',
                  'lottery',
                  'orders',
                  'delivery',
                  'team',
                  'party',
                ] as SceneId[]
              ).map((id) => (
                <button className="destination-card" key={id} onClick={() => openScene(id)}>
                  <span className="destination-emoji">{scenes[id].icon}</span>
                  <div>
                    <strong>{scenes[id].title}</strong>
                    <small>{scenes[id].description.split('，')[0].split('。')[0]}</small>
                  </div>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
          </section>
          <footer className="dashboard-footer">
            <div className="footer-brand">
              m<span>↗</span> MAKE EVERY MEAL A QUEST.
            </div>
            <p>
              虚拟经验与徽章不等同于麦当劳官方积分。
              {data.connection.mode === 'demo'
                ? '当前使用清晰标注的演示数据。'
                : '交易与权益以官方服务实时返回为准。'}
            </p>
            <button className="text-button" onClick={() => setModal('help')}>
              <CircleHelp size={14} />
              玩法说明
            </button>
          </footer>
        </main>
      </div>

      {mission && (
        <Modal
          title={mission.title}
          subtitle={`${slotInfo[mission.slot].meal}任务 · ${mission.date} · ${mission.people} 人补给`}
          onClose={() => setMission(null)}
          wide
        >
          <div className="builder-objectives">
            <span>
              <Wallet size={15} />
              不超过 {money(mission.budget)}
            </span>
            <span>
              <Target size={15} />
              {mission.requiredCategories.map((item) => categoryNames[item]).join(' + ')}
            </span>
            {mission.minProtein > 0 && (
              <span>
                <Flame size={15} />
                蛋白质 ≥ {mission.minProtein} g
              </span>
            )}
            {mission.maxCalories > 0 && <span>能量 ≤ {mission.maxCalories} kcal</span>}
            <span className={`source-label ${data.connection.mode}`}>
              {data.connection.mode === 'demo' ? '演示任务' : '实时任务'}
            </span>
          </div>
          <div className="builder-layout">
            <div className="builder-menu">
              <div className="store-selector">
                <MapPin size={18} />
                <label className="sr-only" htmlFor="mission-store">
                  选择补给门店
                </label>
                <select
                  id="mission-store"
                  value={store?.storeCode || ''}
                  disabled={!!busy}
                  onChange={(event) => {
                    const selected = stores.find((item) => item.storeCode === event.target.value);
                    if (selected) void loadMenu(selected);
                  }}
                >
                  <option value="">{busy === 'stores' ? '寻找附近补给站…' : '选择补给门店'}</option>
                  {stores.map((item) => (
                    <option key={item.storeCode} value={item.storeCode}>
                      {item.storeName} · {item.distance} 米
                      {item.businessStatus ? '' : ' · 暂停营业'}
                    </option>
                  ))}
                </select>
              </div>
              {store && (
                <p className="store-address">
                  {store.address} <span>门店 {store.storeCode} · 接口参考距离</span>
                </p>
              )}
              <div className="solver-intro">
                <div>
                  <span className="solver-symbol">
                    <Sparkles size={20} />
                  </span>
                  <div>
                    <strong>让 AI 当你的补给搭档</strong>
                    <p>约束搜索三条路线，再用补给服务验价。</p>
                  </div>
                </div>
                <button
                  className="button button-small button-orange"
                  disabled={!!busy || !store}
                  onClick={() => void solve()}
                >
                  {busy === 'solve' ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <Sparkles size={15} />
                  )}{' '}
                  {busy === 'solve' ? '正在寻找路线…' : '寻找三条路线'}
                </button>
              </div>
              {solutions.length > 0 && (
                <div className="solution-grid">
                  {solutions.map((solution, index) => (
                    <button
                      key={solution.id}
                      className="solution-card"
                      disabled={!!busy}
                      onClick={() => chooseSolution(solution)}
                    >
                      <span className="solution-number">路线 0{index + 1}</span>
                      <h4>{solution.label}</h4>
                      <strong>{money(solution.price)}</strong>
                      <p>{solution.explanation}</p>
                      <small>
                        {solution.quote?.source === 'demo'
                          ? '演示验价通过'
                          : solution.officialVerified
                            ? '官方已验价'
                            : '候选估算'}
                        {solution.protein !== null ? ` · ${solution.protein.toFixed(1)}g 蛋白` : ''}
                      </small>
                      <span className="solution-use">
                        装配这套补给 <ArrowRight size={13} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="menu-heading">
                <h3>你的补给卡牌</h3>
                <span className="muted small">点击餐品，自由组合</span>
              </div>
              <div className="category-tabs" role="group" aria-label="餐品分类">
                {(['all', 'main', 'side', 'drink', 'dessert'] as const).map((item) => (
                  <button
                    key={item}
                    className={category === item ? 'selected' : ''}
                    onClick={() => setCategory(item)}
                  >
                    {item === 'all' ? '全部卡牌' : categoryNames[item]}
                  </button>
                ))}
              </div>
              {busy === 'menu' || busy === 'stores' ? (
                <div className="menu-loading">
                  <LoaderCircle size={26} className="spin" />
                  <p>补给卡牌正在抵达…</p>
                </div>
              ) : (
                <div className="product-grid">
                  {availableProducts.map((product) => {
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
                        title="拖入补给箱，或点击加号添加"
                      >
                        <div className={`product-art category-${product.category}`}>
                          <span>{product.emoji}</span>
                          <span className="product-category">
                            {categoryNames[product.category]}
                          </span>
                        </div>
                        <div className="product-details">
                          <h4>{product.name}</h4>
                          <p>
                            {product.nutritionMatched
                              ? `${product.kcal ?? '—'} kcal · ${product.protein ?? '—'}g 蛋白`
                              : '营养数据暂未匹配'}
                          </p>
                          {product.tags.length > 0 && (
                            <div className="product-tags">
                              {product.tags.slice(0, 2).map((tag) => (
                                <span key={tag}>{tag}</span>
                              ))}
                            </div>
                          )}
                          <div className="product-bottom">
                            <strong>{money(product.price)}</strong>
                            {quantity ? (
                              <div className="quantity-control">
                                <button
                                  aria-label={`减少${product.name}`}
                                  onClick={() => changeCart(product.code, -1)}
                                >
                                  <Minus size={13} />
                                </button>
                                <span>{quantity}</span>
                                <button
                                  aria-label={`增加${product.name}`}
                                  onClick={() => changeCart(product.code, 1)}
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            ) : (
                              <button
                                className="product-add"
                                aria-label={`添加${product.name}`}
                                onClick={() => changeCart(product.code, 1)}
                              >
                                <Plus size={17} />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  {!availableProducts.length && (
                    <div className="empty-state">
                      <Backpack size={32} />
                      <p>这个分类暂无可选卡牌。</p>
                    </div>
                  )}
                </div>
              )}
              {coupons.length > 0 && (
                <div className="builder-coupons">
                  <h3>
                    <Backpack size={17} />
                    可装配的优惠卡
                  </h3>
                  {coupons.map((coupon, index) => {
                    const item = asObject(coupon);
                    return (
                      <button
                        key={String(item.couponId || index)}
                        className="coupon-chip"
                        onClick={() => applyCoupon(coupon)}
                      >
                        <span>🎟️</span>
                        {String(item.title || item.couponName || '门店优惠券')}
                        <Plus size={14} />
                      </button>
                    );
                  })}
                </div>
              )}
              <button className="text-button builder-lab-link" onClick={() => openScene('lab')}>
                想研究套餐和特调？进入餐品实验室 <ArrowRight size={14} />
              </button>
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
                const code = event.dataTransfer.getData('application/mc-product');
                if (products.some((product) => product.code === code)) changeCart(code, 1);
              }}
            >
              <div className="cart-heading">
                <div>
                  <span className="eyebrow">YOUR LOADOUT</span>
                  <h3>任务补给箱</h3>
                </div>
                <Backpack size={24} />
              </div>
              {cart.length ? (
                <div className="cart-items">
                  {cart.map((item) => {
                    const product = products.find((entry) => entry.code === item.productCode);
                    return (
                      <div className="cart-item" key={item.productCode}>
                        <span className="cart-item-emoji">{product?.emoji || '🍔'}</span>
                        <div>
                          <strong>{product?.name || item.productCode}</strong>
                          <small>
                            {product ? money(product.price * item.quantity) : '待验价'}
                            {item.couponId ? ' · 已装配优惠卡' : ''}
                          </small>
                        </div>
                        <div className="quantity-control">
                          <button
                            aria-label={`减少${product?.name || '餐品'}`}
                            onClick={() => changeCart(item.productCode, -1)}
                          >
                            <Minus size={12} />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            aria-label={`增加${product?.name || '餐品'}`}
                            onClick={() => changeCart(item.productCode, 1)}
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
                  <strong>给冒险装点好吃的</strong>
                  <p>从卡牌里选几样餐品，或试试 AI 搭配路线。</p>
                </div>
              )}
              <div className="cart-budget">
                <span>{quote ? '验价后总额' : '餐品标价合计'}</span>
                <strong className={(quote?.price || total) > mission.budget ? 'over-budget' : ''}>
                  {money(quote?.price ?? total)}
                </strong>
                <div className="budget-track">
                  <span
                    style={{
                      width: `${Math.min(100, ((quote?.price ?? total) / mission.budget) * 100)}%`,
                    }}
                  />
                </div>
                <small>
                  任务预算 {money(mission.budget)}
                  {quote
                    ? ` · 优惠 ${money(quote.discount)} · 费用 ${money(quote.fees)}`
                    : ' · 最终价格以验价结果为准'}
                </small>
              </div>
              <button
                className="button button-charcoal full-width"
                disabled={!cart.length || !!busy}
                onClick={() => void verify()}
              >
                {busy === 'quote' ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <ShieldCheck size={17} />
                )}{' '}
                {data.connection.mode === 'demo' ? '模拟补给验价' : '调用官方验价'}
              </button>
              {quote && (
                <div className="quote-evaluation">
                  <div className="evaluation-heading">
                    <strong>
                      {quote.evaluation.passed ? '所有任务目标已达成' : '再调整一下，就能出发'}
                    </strong>
                    {quote.evaluation.passed ? <CheckCheck size={18} /> : <Target size={18} />}
                  </div>
                  {quote.evaluation.checks.map((check, index) => (
                    <div className={`evaluation-check ${check.passed ? 'passed' : ''}`} key={index}>
                      <span>{check.passed ? <Check size={13} /> : <Minus size={13} />}</span>
                      <div>
                        <strong>{check.label}</strong>
                        <small>{check.detail}</small>
                      </div>
                    </div>
                  ))}
                  <p>
                    营养匹配覆盖率 {Math.round(quote.evaluation.coverage * 100)}% ·{' '}
                    {quote.source === 'demo' ? '演示验价' : '官方验价'}
                    <br />
                    能量 {quote.evaluation.kcal === null
                      ? '未知'
                      : `${quote.evaluation.kcal} kcal`}{' '}
                    · 蛋白质{' '}
                    {quote.evaluation.protein === null
                      ? '未知'
                      : `${quote.evaluation.protein.toFixed(1)} g`}
                  </p>
                  <button
                    className={`button full-width ${mission.status === 'complete' ? 'button-outline' : 'button-orange'}`}
                    disabled={!!busy || !quote.evaluation.passed || mission.status === 'complete'}
                    onClick={() => void complete()}
                  >
                    {busy === 'complete' ? (
                      <LoaderCircle size={17} className="spin" />
                    ) : (
                      <Trophy size={17} />
                    )}{' '}
                    {mission.status === 'complete'
                      ? '任务已通关'
                      : `完成任务 · +${mission.reward} XP`}
                  </button>
                </div>
              )}
              {builderError && (
                <div role="alert" className="error-banner">
                  {builderError}
                </div>
              )}
              <div className="cart-separator" />
              <div className="optional-checkout">
                <span className="eyebrow">把好方案带进生活</span>
                <p>
                  想尝尝这套搭配？
                  <br />
                  选好取餐方式，先查看订单预览。
                </p>
                {quote && (
                  <label className="form-field">
                    <span>取餐方式</span>
                    <select value={takeWay} onChange={(event) => setTakeWay(event.target.value)}>
                      {quote.takeWays.map((item) => (
                        <option value={item.code} key={item.code}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  className="button button-outline full-width"
                  disabled={!quote || !!busy || !takeWay}
                  onClick={() => void checkout()}
                >
                  {busy === 'checkout' ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Rocket size={16} />
                  )}{' '}
                  {data.connection.mode === 'demo' ? '体验演示下单' : '预览真实订单'}
                  <ArrowRight size={14} />
                </button>
                <button
                  className="text-button share-button"
                  disabled={!!busy}
                  onClick={() => void share()}
                >
                  {shared ? <Check size={14} /> : <Copy size={14} />}{' '}
                  {shared ? '挑战卡已复制' : '分享这份挑战'}
                </button>
              </div>
              <p className="cart-footnote">
                虚拟通关无需购买。真实餐品订单需单独确认，并在官方页面完成支付。
              </p>
            </aside>
          </div>
        </Modal>
      )}

      {modal === 'profile' && profileDraft && (
        <Modal
          title="你的特工档案"
          subtitle="预算、口味和出发位置，让每一天都与你有关。"
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveProfile();
            }}
            className="settings-form"
          >
            <div className="form-grid">
              <label className="form-field">
                <span>特工代号</span>
                <input
                  required
                  maxLength={30}
                  value={profileDraft.name}
                  onChange={(event) =>
                    setProfileDraft({ ...profileDraft, name: event.target.value })
                  }
                />
              </label>
              <label className="form-field">
                <span>所在城市</span>
                <input
                  required
                  value={profileDraft.city}
                  onChange={(event) =>
                    setProfileDraft({ ...profileDraft, city: event.target.value })
                  }
                />
              </label>
              <label className="form-field span-two">
                <span>出发位置</span>
                <input
                  required
                  value={profileDraft.location}
                  onChange={(event) =>
                    setProfileDraft({ ...profileDraft, location: event.target.value })
                  }
                />
              </label>
            </div>
            <h3>
              三餐预算 <small>单位：元</small>
            </h3>
            <div className="budget-form-grid">
              {(['breakfast', 'lunch', 'dinner'] as const).map((slot) => {
                const Icon = slotInfo[slot].icon;
                return (
                  <label className="form-field" key={slot}>
                    <span>
                      <Icon size={15} />
                      {slotInfo[slot].meal}
                    </span>
                    <div className="currency-input">
                      <span>¥</span>
                      <input
                        type="number"
                        required
                        min={5}
                        max={1000}
                        step=".01"
                        value={profileDraft.budgets[slot] / 100}
                        onChange={(event) =>
                          setProfileDraft({
                            ...profileDraft,
                            budgets: {
                              ...profileDraft.budgets,
                              [slot]: Math.round(Number(event.target.value) * 100),
                            },
                          })
                        }
                      />
                    </div>
                  </label>
                );
              })}
            </div>
            <h3>你的口味偏好</h3>
            <div className="preference-options">
              {['不吃辣', '喜欢鸡肉', '少甜', '多样搭配', '蛋白优先', '只想省钱'].map(
                (preference) => (
                  <button
                    type="button"
                    key={preference}
                    aria-pressed={profileDraft.preferences.includes(preference)}
                    className={profileDraft.preferences.includes(preference) ? 'selected' : ''}
                    onClick={() =>
                      setProfileDraft({
                        ...profileDraft,
                        preferences: profileDraft.preferences.includes(preference)
                          ? profileDraft.preferences.filter((item) => item !== preference)
                          : [...profileDraft.preferences, preference],
                      })
                    }
                  >
                    {profileDraft.preferences.includes(preference) && <Check size={13} />}{' '}
                    {preference}
                  </button>
                ),
              )}
            </div>
            <div className="form-grid nutrition-form">
              <label className="form-field">
                <span>单餐能量目标上限（kcal）</span>
                <input
                  type="number"
                  min={200}
                  max={2500}
                  required
                  value={profileDraft.calorieTarget}
                  onChange={(event) =>
                    setProfileDraft({ ...profileDraft, calorieTarget: Number(event.target.value) })
                  }
                />
              </label>
              <label className="form-field">
                <span>单餐蛋白质目标（g）</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={profileDraft.proteinTarget}
                  onChange={(event) =>
                    setProfileDraft({ ...profileDraft, proteinTarget: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <p className="information-banner">
              每天早、中、晚各一份稳定的个人任务。保存后从明天应用新偏好；切换演示身份可立即看到另一位特工的任务。营养仅作数据参考。
            </p>
            {settingsError && (
              <div className="error-banner" role="alert">
                {settingsError}
              </div>
            )}
            <div className="settings-footer">
              <button
                type="button"
                className="button button-outline"
                onClick={() => setModal(null)}
              >
                先这样
              </button>
              <button className="button button-orange" disabled={!!busy}>
                {busy === 'profile' ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Check size={16} />
                )}
                保存特工档案
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === 'connection' && (
        <Modal
          title="连接你的补给世界"
          subtitle="演示可以随时玩，连接后使用你的个人麦当劳 MCP 数据。"
          onClose={() => {
            setToken('');
            setModal(null);
          }}
        >
          <div className="settings-form">
            <div className="connection-status-card">
              <span className={`status-dot ${data.connection.mode}`} />
              <div>
                <strong>
                  {data.connection.mode === 'demo' ? '你正在演示世界' : '你的个人补给信号已连接'}
                </strong>
                <p>
                  {data.connection.mode === 'demo'
                    ? '使用明确标记的模拟门店、餐品、券与积分。'
                    : data.connection.label}
                </p>
              </div>
              <span className="connection-tool-count">{data.connection.toolCount} 项能力</span>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void connection();
              }}
            >
              <label className="form-field">
                <span>个人 MCP Token</span>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="输入你的个人访问 Token"
                />
              </label>
              <p className="connection-security">
                <ShieldCheck size={17} />
                Token 由服务端保管，不会写进前端存储或显示在页面上。
              </p>
              <div className="information-banner">
                真实订单、积分兑换、地址创建和抽奖都先预览，确认后执行。付款仍在麦当劳官方页面完成。
              </div>
              {settingsError && (
                <div role="alert" className="error-banner">
                  {settingsError}
                </div>
              )}
              <div className="settings-footer">
                {data.connection.mode === 'live' ? (
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={!!busy}
                    onClick={() => void connection(true)}
                  >
                    断开并回到演示
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => setModal(null)}
                  >
                    继续玩演示
                  </button>
                )}
                <button className="button button-orange" disabled={!!busy || !token}>
                  {busy === 'connection' ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Radio size={16} />
                  )}
                  连接实时世界
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
      {modal === 'achievements' && (
        <Modal
          title="每一次出发，都算数"
          subtitle="这里记录属于补给局的虚拟成长，与官方积分相互独立。"
          onClose={() => setModal(null)}
        >
          <div className="achievement-modal">
            <div className="achievement-stats">
              <div>
                <Zap size={24} />
                <strong>{data.stats.xp}</strong>
                <span>累计经验 XP</span>
              </div>
              <div>
                <CheckCheck size={24} />
                <strong>{data.stats.completed}</strong>
                <span>完成任务</span>
              </div>
              <div>
                <Flame size={24} />
                <strong>{data.stats.streak}</strong>
                <span>连续冒险天数</span>
              </div>
            </div>
            <div className="badge-grid">
              {data.stats.badges.length ? (
                data.stats.badges.map((badge, index) => (
                  <div className="collected-badge" key={badge}>
                    <span>{['🏅', '🌟', '🚀', '🎯', '🍔'][index % 5]}</span>
                    <strong>{badge}</strong>
                    <small>已解锁 · 虚拟成就</small>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <Award size={41} />
                  <h3>第一枚徽章，在下一次冒险里</h3>
                  <p>完成一份今日任务，就能开启你的收藏。</p>
                </div>
              )}
            </div>
            <button className="button button-orange full-width" onClick={() => setModal(null)}>
              继续我的冒险 <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {modal === 'help' && (
        <Modal
          title="欢迎加入麦麦补给局"
          subtitle="不必消费，也能玩一场完整的补给冒险。"
          onClose={() => setModal(null)}
        >
          <div className="help-content">
            {[
              {
                icon: Compass,
                title: '接一份属于你的任务',
                text: '每天早、中、晚各一份任务。预算、口味和档案参与生成，每位特工都有自己的任务种子。',
              },
              {
                icon: Swords,
                title: '用真实约束，做有意思的搭配',
                text: '选择门店和餐品，自由装配优惠卡。AI 搭档用约束搜索给出省钱、蛋白和多样路线，结果经补给服务核价。',
              },
              {
                icon: Trophy,
                title: '验价通过，就能免费通关',
                text: '达成条件即可获取虚拟 XP 和徽章。经验与徽章不能兑换官方积分、权益或现金。',
              },
              {
                icon: Rocket,
                title: '想吃的时候，再执行补给',
                text: '真实订单、兑换、抽奖和活动预约先展示具体内容与消耗，由你确认；付款在官方页面完成。',
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="help-step">
                <span>
                  <Icon size={23} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
            <div className="information-banner">
              门店距离由接口提供，城市插画是示意图。营养缺失会明确显示；特调后的营养不作补造。我们不会提供官方任务积分、GPS
              签到或自动连续抽奖。
            </div>
            <button className="button button-orange full-width" onClick={() => setModal(null)}>
              准备好了，出发 <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {scene && (
        <ScenePanel
          key={`${scene}-${scenePreview?.confirmationId || 'explore'}`}
          scene={scene}
          profile={data.profile}
          mode={data.connection.mode}
          store={store}
          cart={cart}
          initialPreview={scenePreview}
          onClose={() => {
            setScene(null);
            setScenePreview(undefined);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span>
            <Check size={16} />
          </span>
          {toast}
          <button aria-label="关闭提示" onClick={() => setToast('')}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
