// src/components/Leaderboards.js
import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
  return (u?.username && String(u.username).trim())
      || (u?.name && String(u.name).trim())
      || shortId(u?.user_id);
}

// постараемся взять тот же userId, что использует приложение
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

  const [wallet, setWallet] = useState('');
  const [walletMsg, setWalletMsg] = useState(null);
  const [savingWallet, setSavingWallet] = useState(false);

  // определяем userId (из пропса или из хранилища/Telegram)
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

  // Мои текущие данные (для подписи + кошелёк)
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
          setMe(data || null);
          if (data?.wallet && !wallet) setWallet(String(data.wallet));
        }
      } catch (e) {
        if (!stop) setErrMe(e.message || 'Failed to load your data');
        console.error('Ошибка при получении данных пользователя:', e);
      }
    };

    loadMe();
    const t = setInterval(loadMe, 30000);
    return () => { stop = true; clearInterval(t); };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ранг пользователя в топ-10 (если входит)
  const myRankInTop = useMemo(() => {
    if (!me || !leaders || leaders.length === 0) return null;
    const idx = leaders.findIndex(u => String(u.user_id) === String(me.user_id));
    return idx >= 0 ? idx + 1 : null;
  }, [me, leaders]);

  // Порог для кошелька
  const eligible = !!me && ((me.walletEligible === true) || ((me.coins || 0) >= 100));
  const hasWallet = !!me?.wallet;

  // Одноразовое уведомление при достижении 100+
  useEffect(() => {
    if (!eligible || !userId) return;
    const key = `wallet_notified_${userId}`;
    if (!localStorage.getItem(key)) {
      setWalletMsg('🎉 You reached 100 tokens! Add your crypto wallet to receive rewards.');
      localStorage.setItem(key, '1');
    }
  }, [eligible, userId]);

  // Сохранение кошелька
  const saveWallet = useCallback(async () => {
    setWalletMsg(null);
    const val = String(wallet || '').trim();
    if (val.length < 6) {
      setWalletMsg('The wallet address looks too short.');
      return;
    }
    try {
      setSavingWallet(true);
      const res = await fetch(`${SERVER_URL}/setWallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, wallet: val }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setWalletMsg('Wallet saved ✅');
      setMe(prev => prev ? { ...prev, wallet: data.wallet } : prev);
    } catch (e) {
      setWalletMsg(`Failed to save: ${e.message}`);
    } finally {
      setSavingWallet(false);
    }
  }, [userId, wallet]);

  return (
    <div className="lb-wrapper">
      <img src={leaderboardText} alt="LEADERBOARD" className="lb-title" />

      <div className="lb-board">
        <img src={boardImage} alt="Board" className="lb-board-img" />
        <div className="lb-overlay">
          {/* шапка скрыта CSS'ом (lb-head { display: none }) */}
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
                    <span className="lb-me-rank">
                      Rank: {typeof myRankInTop === 'number' ? `#${myRankInTop}` : 'N/A'}
                    </span>
                    <span className="lb-me-accuracy">
                      Accuracy: {Math.round(me.best_score || 0)}%
                    </span>
                    <span className="lb-me-tokens">
                      Tokens: {Number(me.coins || 0).toFixed(2)}
                    </span>
                  </>
                ) : (
                  <span className="faded">Loading your results…</span>
                )}
              </div>

      {/* поле кошелька — под "Your position" */}
      {me && (
        <div className="wallet-block">
          {eligible && !hasWallet ? (
            <>
              <div className="wallet-hint">
                {walletMsg || '🎉 You reached 100 tokens! Add your crypto wallet to receive rewards.'}
              </div>
              <div className="wallet-form">
                <input
                  className="wallet-input"
                  type="text"
                  placeholder="Paste your wallet address"
                  value={wallet}
                  onChange={e => setWallet(e.target.value)}
                  disabled={savingWallet}
                />
                <button
                  className="wallet-save"
                  onClick={saveWallet}
                  disabled={savingWallet || !wallet.trim()}>
                  {savingWallet ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          ) : hasWallet ? (
            <div className="wallet-view">
              Wallet: <span className="mono">{me.wallet}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default Leaderboards;
