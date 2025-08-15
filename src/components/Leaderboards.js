import React, { useEffect, useState } from 'react';
import './Leaderboards.css';
import leaderboardText from '../assets/leaderboard_text.png';
import boardImage from '../assets/board.png';

const SERVER_URL = 'https://draw-a-circle.chickenkiller.com';

function shortId(id) {
  const s = String(id || '');
  return s.length > 8 ? `${s.slice(0, 8)}…` : s;
}

const Leaderboards = ({ userId }) => {
  const [leaders, setLeaders] = useState([]);
  const [me, setMe] = useState(null);

  // загрузка ТОП-10 с автообновлением
  useEffect(() => {
    let stop = false;

    const loadLeaders = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/getLeaderboard`);
        const data = await res.json();
        if (!stop) setLeaders(Array.isArray(data) ? data.slice(0, 10) : []);
      } catch (e) {
        console.error('Ошибка при получении таблицы лидеров:', e);
      }
    };

    loadLeaders();
    const t = setInterval(loadLeaders, 30000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  // мои текущие данные (для подписи под доской)
  useEffect(() => {
    if (!userId) return;
    let stop = false;

    const loadMe = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/getUserData`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        });
        const data = await res.json();
        if (!stop) setMe(data || null);
      } catch (e) {
        console.error('Ошибка при получении данных пользователя:', e);
      }
    };

    loadMe();
    const t = setInterval(loadMe, 30000);
    return () => { stop = true; clearInterval(t); };
  }, [userId]);

  return (
    <div className="lb-wrapper">
      <img src={leaderboardText} alt="LEADERBOARD" className="lb-title" />
      <div className="lb-board">
        <img src={boardImage} alt="Board" className="lb-board-img" />
        <div className="lb-overlay">
          {/* заголовки колонок (сверху на доске, белым) */}
          <div className="lb-row lb-head">
            <div className="col-rank">№</div>
            <div className="col-name">name</div>
            <div className="col-acc">accuracy</div>
            <div className="col-tok">tokens</div>
          </div>
          {/* строки топ-10 */}
          {leaders.length > 0 ? (
            leaders.map((u, i) => (
              <div className="lb-row" key={u.user_id || i}>
                <div className="col-rank">{i + 1}</div>
                <div className="col-name">User {shortId(u.user_id)}</div>
                <div className="col-acc">
                  {typeof u.best_score === 'number' ? `${Math.round(u.best_score)}%` : '—'}
                </div>
                <div className="col-tok">
                  {typeof u.coins === 'number' ? u.coins.toFixed(2) : '0.00'}
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
        {me ? (
          <>
            <span className="dot">•</span>{' '}
            <span>
              User {shortId(me.user_id)}:&nbsp;
              {Number(me.coins || 0).toFixed(2)} coins,&nbsp;
              best circle — {Math.round(me.best_score || 0)}%
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
