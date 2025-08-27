import React, { useEffect, useState, useMemo } from 'react';
import './Leaderboards.css';
import leaderboardText from '../assets/leaderboard_text.png';
import boardImage from '../assets/board.png';

const SERVER_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:8000'
    : '/api';

function shortId(id) {
  const s = String(id || '');
  return s.length > 10 ? `${s.slice(0, 10)}…` : s;
}

function displayName(u) {
  const base =
    (u?.username && String(u.username).trim()) ||
    (u?.name && String(u.name).trim()) ||
    String(u?.user_id || '');
  return base.length > 10 ? `${base.slice(0, 10)}…` : base;
}

// Форматируем монеты согласно правилу
function formatCoins(coins) {
  if (!Number.isFinite(coins)) {
    return '0.00';
  }
  return coins > 1000 ? Number(coins).toFixed(1) : Number(coins).toFixed(2);
}

function getStoredUserId() {
  try {
    const tgId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (tgId) return String(tgId);
  } catch {}
  try {
    const id = localStorage.getItem('circleGameUserId');
    if (id) return id;
  } catch {}
  return null;
}

const Leaderboards = ({ userId: propUserId }) => {
  const [leaders, setLeaders] = useState([]);
  const [me, setMe] = useState(null);
  const [errTop, setErrTop] = useState(null);
  const [errMe, setErrMe] = useState(null);

  // Определяем userId
  const [userId, setUserId] = useState(propUserId || null);
  useEffect(() => {
    if (propUserId) { setUserId(String(propUserId)); return; }
    const id = getStoredUserId();
    if (id) setUserId(id);
  }, [propUserId]);

  // ТОП-10 с автообновлением
  useEffect(() => {
    let stop = false;

    const loadLeaders = async () => {
      try {
        setErrTop(null);
        const res = await fetch(`${SERVER_URL}/getLeaderboard`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();

        if (!stop) {
          const rows = Array.isArray(raw) ? raw : [];
          let telegramOnly = rows.filter(u => !String(u.user_id).startsWith('browser_'));
          if (telegramOnly.length === 0) telegramOnly = rows;
          setLeaders(telegramOnly.slice(0, 10));
        }
      } catch (e) {
        if (!stop) setErrTop(e.message || 'Failed to load leaderboard');
        console.error('Ошибка при получении таблицы лидеров:', e);
      }
    };

    loadLeaders();
    const t = setInterval(loadLeaders, 30000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  // Мои текущие данные
  useEffect(() => {
    if (!userId) return;
    let stop = false;

    const loadMe = async () => {
      try {
        setErrMe(null);
        const res = await fetch(`${SERVER_URL}/getUserData`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!stop) {
          setMe(data);
        }
      } catch (e) {
        if (!stop) setErrMe(e.message || 'Failed to load your data');
        console.error('Ошибка при получении данных пользователя:', e);
      }
    };

    loadMe();
    const t = setInterval(loadMe, 30000);
    return () => { stop = true; clearInterval(t); };
  }, [userId]);

  // Ранг пользователя в топ-10
  const myRankInTop = useMemo(() => {
    if (!me || !leaders || leaders.length === 0) return null;
    const idx = leaders.findIndex(u => String(u.user_id) === String(me.user_id));
    return idx >= 0 ? idx + 1 : null;
  }, [me, leaders]);

  return (
    <div className="lb-wrapper">
      <img src={leaderboardText} alt="LEADERBOARD" className="lb-title" />

      <div className="lb-board">
        <img src={boardImage} alt="Board" className="lb-board-img" />
        <div className="lb-overlay">
          <div className="lb-row lb-head">
            <div className="col-rank">№</div>
            <div className="col-name">name</div>
            <div className="col-acc">accuracy</div>
            <div className="col-tok">tokens</div>
          </div>

          {errTop ? (
            <div className="lb-empty">Failed to load leaderboard ({errTop})</div>
          ) : leaders.length > 0 ? (
            leaders.map((u, i) => (
              <div className="lb-row" key={u.user_id || i}>
                <div className="col-rank">{i + 1}</div>
                <div className="col-name">{displayName(u)}</div>
                <div className="col-stats">
                  <span className="col-acc">
                    {Number.isFinite(u?.best_score) ? `${Math.round(u.best_score)}%` : '—'}
                  </span>
                  <span className="col-tok">
                    {formatCoins(u?.coins)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="lb-empty">No data to display yet.</div>
          )}
        </div>
      </div>

      <div className="lb-me">
        {errMe ? (
          <span className="faded">Failed to load your results ({errMe})</span>
        ) : me ? (
          <>
            <span className="lb-me-rank">
              Rank: {typeof myRankInTop === 'number' ? `#${myRankInTop}` : 'N/A'}
            </span>
            <span className="lb-me-accuracy">
              Accuracy: {Math.round(me.best_score || 0)}%
            </span>
            <span className="lb-me-tokens">
              Tokens: {formatCoins(me.coins)}
            </span>
          </>
        ) : (
          <span className="faded">Loading your results…</span>
        )}
      </div>
    </div>
  );
};

export default Leaderboards;