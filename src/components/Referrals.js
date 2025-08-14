
import React, { useState, useEffect } from 'react';
import './Referrals.css';
import referralProgramImage from '../assets/referral_program.png';
import inviteImage from '../assets/invite.png';
import copyImage from '../assets/copy.png';
import yourReferralsImage from '../assets/your_referrals.png';
import linkImage from '../assets/link.png';

const SERVER_URL = 'http://45.153.69.251:8000'; // Убедитесь, что URL верный

// 1. Принимаем userId как пропс
const Referrals = ({ userId, coins, onTaskComplete, completedTasks }) => {
  const [referrals, setReferrals] = useState([]);
  const [referralLink, setReferralLink] = useState('Generating link...'); // Начальный текст

  useEffect(() => {
    // 2. Используем userId из пропсов, а не из URL
    if (userId) {
      // Генерируем реферальную ссылку
      const baseUrl = window.location.origin;
      setReferralLink(`${baseUrl}/?ref=${userId}`);

      // Загружаем список рефералов
      fetch(`${SERVER_URL}/getReferrals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      })
      .then(res => res.json())
      .then(data => {
        setReferrals(data);
      })
      .catch(err => console.error('Ошибка при получении рефералов:', err));
    }
  }, [userId]); // 3. Запускаем эффект, когда userId становится доступен

  const copyToClipboard = () => {
    if (referralLink && !referralLink.includes('Generating')) {
      navigator.clipboard.writeText(referralLink);
      alert('Referral link copied to clipboard!');
    }
  };

  return (
    <div className="referrals-container">
      <img src={referralProgramImage} alt="Referral Program" />
      <img src={inviteImage} alt="Invite friends" className="invite-image" />

      <div className="referral-link">
        <div className="link-field">
          <img src={linkImage} alt="Referral link" className="link-image" />
          <span className="link-text">{referralLink}</span>
        </div>
        <div className="copy-button" onClick={copyToClipboard}>
          <img src={copyImage} alt="Copy" />
        </div>
      </div>

      <img src={yourReferralsImage} alt="Your Referrals" className="your-referrals-image" />
      {referrals.length > 0 ? (
        <ul className="referrals-list">
          {referrals.map((ref) => (
            <li key={ref.user_id}>
              User {String(ref.user_id).substring(0, 8)}...: {ref.coins.toFixed(2)} coins, best circle — {ref.best_score}%
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