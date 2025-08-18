import React, { useState, useEffect } from 'react';
import './Referrals.css';
import referralProgramImage from '../assets/referral_program.png';
import inviteImage from '../assets/invite.png';
import copyImage from '../assets/copy.png';
import yourReferralsImage from '../assets/your_referrals.png';
import linkImage from '../assets/link.png';

const SERVER_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:8000'  // локально бьёмся напрямую в ваш backend
    : '/api';                  // на Vercel ходим на тот же origin, а rewrites прокинут дальше

const Referrals = ({ userId }) => {
  const [referrals, setReferrals] = useState([]);
  const [referralLink, setReferralLink] = useState('');

  // 1) Сформировать личную ссылку
  useEffect(() => {
    if (!userId) return;
    const baseUrl = window.location.origin;
    setReferralLink(`${baseUrl}/?ref=${userId}`);
  }, [userId]);

  // 2) Мои рефералы для списка (автообновление)
    useEffect(() => {
        if (!userId) return;

        const loadMyRefs = async () => {
          try {
            const res = await fetch(`${SERVER_URL}/getReferrals`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: userId }),
            });
            const data = await res.json();
            // Проверяем, что data это массив, прежде чем обновлять состояние
            if (Array.isArray(data)) {
              setReferrals(data);
            }
          } catch (e) {
            console.error('Ошибка при получении рефералов:', e);
          }
        };

        loadMyRefs();
        // Интервал убран. Данные загрузятся один раз при монтировании компонента.
      }, [userId]);

const copyToClipboard = async () => {
    if (!navigator.clipboard) {
      // Fallback для очень старых или небезопасных (не HTTPS) контекстов
      const textArea = document.createElement("textarea");
      textArea.value = referralLink;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        alert('Referral link copied to clipboard!');
      } catch (err) {
        console.error('Fallback copy failed: ', err);
      }
      document.body.removeChild(textArea);
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      alert('Referral link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="referrals-container">
      <img src={referralProgramImage} alt="Referral Program" className="r-title" />
      <img src={inviteImage} alt="Invite friends" className="invite-image" />

      <div className="referral-link">
        <div className="link-field">
          <img src={linkImage} alt="Referral link" className="link-image" />
          <span className="link-text">✨Your magic invite link</span>
        </div>
        <button className="copy-button" onClick={copyToClipboard}>
          <img src={copyImage} alt="Copy" />
        </button>
      </div>

      <img src={yourReferralsImage} alt="Your Referrals" className="your-referrals-image" />

      {referrals.length > 0 ? (
        <ul className="referrals-list">
          {referrals.map((ref) => {
            const coins = typeof ref.coins === 'number' ? ref.coins.toFixed(2) : '0.00';
            const best = typeof ref.best_score === 'number' ? Math.round(ref.best_score) : 0;

            // Используем username, если он есть и не пустой, иначе - короткий ID
            const displayName = (ref.username && String(ref.username).trim()) || `User_${String(ref.user_id).slice(-4)}`; // <-- УЛУЧШЕННАЯ ЛОГИКА

        return (
              <li key={ref.user_id} className="ref-item">
                <span className="ref-name">{displayName}</span>
                <div className="ref-stats">
                  {/* У нас нет ранга для рефералов, поэтому показываем только точность и токены */}
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
