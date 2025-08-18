import React, { useState, useEffect } from 'react';
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

  // Генерируем deep link в Telegram Mini App
  useEffect(() => {
    if (!userId) return;
    const deepLink = `https://t.me/${BOT_USERNAME}?startapp=ref_${userId}`;
    setReferralLink(deepLink);
  }, [userId]);

  // Загружаем список рефералов (поллинг)
  useEffect(() => {
    if (!userId) return;
    let stop = false;

    const loadMyRefs = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/getReferrals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
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
