'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Copy, LoaderCircle, Users } from 'lucide-react';
type Room = {
  id: string;
  name: string;
  members: { id: string; name: string; budget: number; preferences: string[] }[];
  version: number;
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
  if (!response.ok) throw new Error(data.error || '小队信号中断');
  return data as Room;
}
export function TeamRoom({ onBudget }: { onBudget: (people: number, budget: number) => void }) {
  const [room, setRoom] = useState<Room>();
  const [name, setName] = useState('今晚不鸽补给队');
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!room) return;
    let disposed = false;
    const timer = setInterval(() => {
      api(`/api/game/rooms?id=${encodeURIComponent(room.id)}`)
        .then((next) => {
          if (!disposed) setRoom(next);
        })
        .catch(() => {});
    }, 3500);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [room?.id]);
  async function act(join = false) {
    setBusy(true);
    setError('');
    try {
      setRoom(
        await api(
          join ? '/api/game/rooms/join' : '/api/game/rooms',
          join ? { id: id.trim() } : { name },
        ),
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : '小队暂时无法创建。');
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.id);
      setCopied(true);
    } catch {
      setId(room.id);
    }
  }
  const budget = room?.members.reduce((sum, member) => sum + member.budget, 0) || 0;
  return (
    <details className="team-room">
      <summary>
        <Users size={18} />
        一起玩，小队才有意思 <span>创建 / 加入协作房间</span>
      </summary>
      {room ? (
        <div className="room-content">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LIVE COOPERATIVE ROOM</span>
              <h3>{room.name}</h3>
            </div>
            <button className="text-button" onClick={() => void copy()}>
              <Copy size={13} />
              {copied ? '已复制' : '复制邀请码'}
            </button>
          </div>
          <div className="room-code">{room.id}</div>
          <div className="room-members">
            {room.members.map((member) => (
              <div key={member.id}>
                <span>{member.name.slice(0, 1)}</span>
                <strong>{member.name}</strong>
                <small>
                  ¥{member.budget / 100} · {member.preferences.join(' / ') || '随心搭配'}
                </small>
              </div>
            ))}
          </div>
          <div className="room-total">
            <p>
              {room.members.length} 人已加入 · 预算合计 <strong>¥{budget / 100}</strong>
            </p>
            <button
              className="button button-small button-orange"
              onClick={() => onBudget(room.members.length, budget)}
            >
              带入小队人数 <ArrowRight size={13} />
            </button>
          </div>
          <p className="room-note">
            朋友在同一应用地址、独立浏览器身份中输入邀请码即可加入。成员自动同步；这是补给局自建协作房间。
          </p>
        </div>
      ) : (
        <div className="room-create">
          <div>
            <label className="form-field">
              <span>新小队名称</span>
              <input
                value={name}
                maxLength={30}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <button
              className="button button-small button-charcoal"
              disabled={busy || !name.trim()}
              onClick={() => void act()}
            >
              {busy ? <LoaderCircle size={14} className="spin" /> : <Users size={14} />} 创建小队
            </button>
          </div>
          <div>
            <label className="form-field">
              <span>已有小队邀请码</span>
              <input
                value={id}
                onChange={(event) => setId(event.target.value)}
                placeholder="输入朋友分享的邀请编号"
              />
            </label>
            <button
              className="button button-small button-outline"
              disabled={busy || !id.trim()}
              onClick={() => void act(true)}
            >
              加入小队 <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
    </details>
  );
}
