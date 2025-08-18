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
  // безопасные фолбэки на разные возможные поля
  return (u?.username && String(u.username).trim()) ||
         (u?.name && String(u.name).trim()) ||
         shortId(u?.user_id);
}

const Leaderboards = ({ userId }) => {
  const [leaders, setLeaders] = useState([]);
  const [me, setMe] = useState(null);
  const [errTop, setErrTop] = useState(null);
  const [errMe, setErrMe] = useState(null);

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
          // если после фильтра пусто — покажем як есть (полезно на пустой базе)
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

  // Мои текущие данные (для подписи снизу)
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
        if (!stop) setMe(data || null);
      } catch (e) {
        if (!stop) setErrMe(e.message || 'Failed to load your data');
        console.error('Ошибка при получении данных пользователя:', e);
      }
    };

    loadMe();
    const t = setInterval(loadMe, 30000);
    return () => { stop = true; clearInterval(t); };
  }, [userId]);

  // Ранг пользователя в топ-10 (если входит)
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
          {/* заголовки колонок */}
          <div className="lb-row lb-head">
            <div className="col-rank">№</div>
            <div className="col-name">name</div>
            <div className="col-acc">accuracy</div>
            <div className="col-tok">tokens</div>
          </div>

          {/* ошибка / пусто / данные */}
          {errTop ? (
            <div className="lb-empty">Failed to load leaderboard ({errTop})</div>
          ) : leaders.length > 0 ? (
            leaders.map((u, i) => (
              <div className="lb-row" key={u.user_id || i}>
                <div className="col-rank">{i + 1}</div>
                <div className="col-name">{displayName(u)}</div>
                <div className="col-acc">
                  {Number.isFinite(u?.best_score) ? `${Math.round(u.best_score)}%` : '—'}
                </div>
                <div className="col-tok">
                  {Number.isFinite(u?.coins) ? Number(u.coins).toFixed(2) : '0.00'}
                </div>
              </div>
            ))
          ) : (
            <div className="lb-empty">No data to display yet.</div>
          )}
        </div>
      </div>

      {/* подпись снизу: текущий пользователь */}
      <div className="lb-me">
        {errMe ? (
          <span className="faded">Failed to load your results ({errMe})</span>
        ) : me ? (
          <>
            <span className="dot">•</span>{' '}
            <span>
              {displayName(me)}:&nbsp;
              {Number(me.coins || 0).toFixed(2)} coins,&nbsp;
              best circle — {Math.round(me.best_score || 0)}%
              {typeof myRankInTop === 'number'
                ? `, rank #${myRankInTop}`
                : `, not in top-10`}
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
