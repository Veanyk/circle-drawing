import React, { useState, useEffect, useRef } from 'react';
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
const APP_SHORT_NAME = process.env.REACT_APP_TG_APP_SHORTNAME || 'circle_drawer';

const Referrals = ({ userId }) => {
  const [referrals, setReferrals] = useState([]);
  const [referralLink, setReferralLink] = useState('');
  const sentOnceRef = useRef(false); // чтобы не слать /acceptReferral много раз

  // Генерируем deep link в Telegram Mini App
    useEffect(() => {
    if (!userId) return;
    const base = APP_SHORT_NAME
    ? `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}`
    : `https://t.me/${BOT_USERNAME}`;
    setReferralLink(`${base}?startapp=ref_${userId}`);
    }, [userId]);

  // Фиксируем реферал, если Mini App открыт по ?startapp=ref_...
  useEffect(() => {
    if (!userId) return;
    if (sentOnceRef.current) return;

    // Безопасно читаем initData/start_param
    const tg = (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
    const initDataRaw = tg?.initData || '';
    const initUnsafe = tg?.initDataUnsafe || {};
    const startParam = initUnsafe?.start_param;

    if (typeof startParam === 'string' && startParam.startsWith('ref_')) {
      const inviterId = Number(startParam.slice(4));
      if (Number.isFinite(inviterId) && inviterId > 0) {
        // Избегаем самореферала на клиенте (на сервере тоже проверяется)
        if (Number(userId) === inviterId) return;

        sentOnceRef.current = true;
        fetch(`${SERVER_URL}/acceptReferral`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inviter_id: inviterId,
            // invitee_id сервер возьмёт из подписанного initData, поле добавлять не обязательно
            initData: initDataRaw,
          }),
        }).catch((e) => console.error('acceptReferral failed:', e));
      }
    }
  }, [userId]);

    // Загружаем список рефералов (поллинг)
    useEffect(() => {
      if (!userId) return;
      let stop = false;

      // берём настоящий tg id, если мы внутри Telegram
      const tgId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      const effectiveId = tgId ? String(tgId) : String(userId);

      const loadMyRefs = async () => {
        try {
          const res = await fetch(`${SERVER_URL}/getReferrals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: effectiveId }),
          });
          const data = await res.json();
          if (!stop && Array.isArray(data)) setReferrals(data);
        } catch (e) {
          console.error('Ошибка при получении рефералов:', e);
        }
      };

      loadMyRefs();
      const iv = setInterval(loadMyRefs, 5000);
      return () => { stop = true; clearInterval(iv); };
    }, [userId]);

  const copyToClipboard = async () => {
    const text = referralLink;
    if (!text) return;

    if (!navigator.clipboard) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); alert('Referral link copied to clipboard!'); }
      catch (err) { console.error('Fallback copy failed:', err); }
      document.body.removeChild(ta);
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      alert('Referral link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy text:', err);
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

      {/* Блок с заголовком и кнопкой — без отображения самой ссылки */}
      <div className="referral-link">
        <div className="link-field">
          <img src={linkImage} alt="Referral link" className="link-image" />
          <span className="link-text">✨Your magic invite link</span>
        </div>
        <button
          className="copy-button"
          onClick={copyToClipboard}
          disabled={!referralLink}
          aria-label="Copy invite link"
          title="Copy invite link"
        >
          <img src={copyImage} alt="Copy" />
        </button>
      </div>

      {/* САМУ ССЫЛКУ НЕ ОТОБРАЖАЕМ */}

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
