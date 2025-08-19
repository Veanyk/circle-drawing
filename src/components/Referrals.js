import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Referrals.css';
import referralProgramImage from '../assets/referral_program.png';
import inviteImage from '../assets/invite.png';
import copyImage from '../assets/copy.png';
import yourReferralsImage from '../assets/your_referrals.png';
import linkImage from '../assets/link.png';

const SERVER_URL =
  process.env.REACT_APP_SERVER_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '/api');

const BOT_USERNAME = process.env.REACT_APP_BOT_USERNAME || 'circle_drawing_bot';

const Referrals = ({ userId }) => {
  const [referrals, setReferrals] = useState([]);
  const [referralLink, setReferralLink] = useState('');
  const sentOnceRef = useRef(false);

  const isNumericId = /^\d+$/.test(String(userId || ''));

  useEffect(() => {
    if (!userId || !isNumericId) {
      setReferralLink('');
      return;
    }
    setReferralLink(`https://t.me/${BOT_USERNAME}?startapp=ref_${userId}`);
  }, [userId, isNumericId]);

  // ЕДИНАЯ функция загрузки рефералов
  const loadMyRefs = useCallback(async () => {
    // Если userId еще не определен, ничего не делаем
    if (!userId) {
      setReferrals([]);
      return;
    }
    try {
      // === ИСПРАВЛЕНИЕ: Проблемная проверка удалена ===
      // Запрос будет отправляться для любого userId, а сервер сам решит, что вернуть.

      const res = await fetch(`${SERVER_URL}/getReferrals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      setReferrals(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Ошибка при получении рефералов:', e);
      setReferrals([]); // В случае ошибки показываем пустой список
    }
  }, [userId]);

  // Привязка реферала по initData (если зашли по startapp=ref_...), затем сразу подтянуть список
  useEffect(() => {
    if (sentOnceRef.current) return;

    const tg = window?.Telegram?.WebApp;
    const initDataRaw = tg?.initData || '';
    const startParam = tg?.initDataUnsafe?.start_param;

    if (typeof startParam !== 'string' || !startParam.startsWith('ref_')) return;

    const inviterId = Number(startParam.slice(4));
    if (!Number.isFinite(inviterId) || inviterId <= 0) return;

    sentOnceRef.current = true;
    try { localStorage.setItem('referrerId', String(inviterId)); } catch (_) {}

    if (initDataRaw) {
      fetch(`${SERVER_URL}/acceptReferral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviter_id: inviterId, initData: initDataRaw }),
      })
      .catch((e) => console.error('acceptReferral failed:', e))
      .finally(() => {
        loadMyRefs();
      });
    } else {
      loadMyRefs();
    }
  }, [loadMyRefs]);

  // Поллинг списка рефералов
  useEffect(() => {
    let stop = false;
    const tick = async () => { if (!stop) await loadMyRefs(); };

    tick(); // первая загрузка
    const iv = setInterval(tick, 5000); // и далее каждые 5с

    return () => { stop = true; clearInterval(iv); };
  }, [loadMyRefs]);

  const copyToClipboard = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      alert('Referral link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy text:', err);
      // Fallback для старых браузеров
      try {
        const ta = document.createElement('textarea');
        ta.value = referralLink;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert('Referral link copied to clipboard!');
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
    }
  };

  const displayName = (u) =>
    (u?.username && String(u.username).trim()) ||
    (u?.name && String(u.name).trim()) ||
    String(u?.user_id || '');

  return (
    <div className="referrals-container">
      <img src={referralProgramImage} alt="Referral Program" className="r-title" />
      <img src={inviteImage} alt="Invite friends" className="invite-image" />

      <div className="referral-link">
        <div className="link-field">
          <img src={linkImage} alt="Referral link" className="link-image" />
          <span className="link-text">
            {isNumericId ? '✨Your magic invite link' : 'Open this app in Telegram to get your invite link'}
          </span>
        </div>
        <button
          className="copy-button"
          onClick={copyToClipboard}
          disabled={!referralLink || !isNumericId}
          aria-label="Copy invite link"
          title={isNumericId ? 'Copy invite link' : 'Available only in Telegram'}
        >
          <img src={copyImage} alt="Copy" />
        </button>
      </div>

      <img src={yourReferralsImage} alt="Your Referrals" className="your-referrals-image" />

      {referrals.length > 0 ? (
        <ul className="referrals-list">
          {referrals.map((ref) => {
            const coins = Number.isFinite(Number(ref.coins)) ? Number(ref.coins).toFixed(2) : '0.00';
            const best = Number.isFinite(Number(ref.best_score)) ? Math.round(Number(ref.best_score)) : 0;
            return (
              <li key={ref.user_id} className="ref-item">
                <span className="ref-name">{displayName(ref)}</span>
                <div className="ref-stats">
                  <span>Accuracy: {best}%</span>
                  <span>Tokens: {coins}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="no-referrals-message">You don't have any referrals yet.</p>
      )}
    </div>
  );
};

export default Referrals;