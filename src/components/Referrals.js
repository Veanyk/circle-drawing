import React, { useState, useEffect, useCallback } from 'react';
import './Referrals.css';
import referralProgramImage from '../assets/referral_program.png';
import inviteImage from '../assets/invite.png';
import copyImage from '../assets/copy.png';
import yourReferralsImage from '../assets/your_referrals.png';
import linkImage from '../assets/link.png';

const SERVER_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '/api';
const BOT_USERNAME = process.env.REACT_APP_BOT_USERNAME || 'circle_drawing_bot';

const Referrals = ({ userId }) => {
  const [referrals, setReferrals] = useState([]);
  const [referralLink, setReferralLink] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const isNumericId = /^\d+$/.test(String(userId || ''));

  useEffect(() => {
    if (isNumericId) {
      setReferralLink(`https://t.me/${BOT_USERNAME}?startapp=ref_${userId}`);
    } else {
      setReferralLink('');
    }
  }, [userId, isNumericId]);

  const loadMyRefs = useCallback(async () => {
    // userId гарантированно не будет null благодаря логике в App.js
    if (!userId) return;

    // console.log(`[Referrals.js] Запрашиваю рефералов для userId: ${userId}`); // <-- Для отладки

    try {
      const res = await fetch(`${SERVER_URL}/getReferrals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      setReferrals(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Ошибка при получении рефералов:', e);
      setReferrals([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Загружаем и затем опрашиваем список рефералов
  useEffect(() => {
    loadMyRefs(); // Первая загрузка
    const interval = setInterval(loadMyRefs, 10000); // Опрос каждые 10 секунд
    return () => clearInterval(interval);
  }, [loadMyRefs]);

  const copyToClipboard = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      alert('Referral link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const displayName = (u) => (u?.username || u?.name || String(u?.user_id || ''));

  return (
    <div className="referrals-container">
      <img src={referralProgramImage} alt="Referral Program" className="r-title" />
      <img src={inviteImage} alt="Invite friends" className="invite-image" />

      <div className="referral-link">
        <div className="link-field">
          <img src={linkImage} alt="Referral link" className="link-image" />
          <span className="link-text">
            {isNumericId ? '✨Your magic invite link' : 'Open in Telegram to get link'}
          </span>
        </div>
        <button
          className="copy-button"
          onClick={copyToClipboard}
          disabled={!isNumericId}
          title={isNumericId ? 'Copy invite link' : 'Available only in Telegram'}
        >
          <img src={copyImage} alt="Copy" />
        </button>
      </div>

      <img src={yourReferralsImage} alt="Your Referrals" className="your-referrals-image" />

      {isLoading ? (
         <p className="no-referrals-message">Loading referrals...</p>
      ) : referrals.length > 0 ? (
        <ul className="referrals-list">
          {referrals.map((ref) => (
            <li key={ref.user_id} className="ref-item">
              <span className="ref-name">{displayName(ref)}</span>
              <div className="ref-stats">
                <span>Accuracy: {Math.round(ref.best_score || 0)}%</span>
                <span>Tokens: {(Number(ref.coins) || 0).toFixed(2)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="no-referrals-message">You don't have any referrals yet.</p>
      )}
    </div>
  );
};

export default Referrals;