// src/components/Referrals.js
import React, { useState, useEffect } from 'react';
import './Referrals.css';
import referralProgramImage from '../assets/referral_program.png';
import inviteImage from '../assets/invite.png';
import copyImage from '../assets/copy.png';
import yourReferralsImage from '../assets/your_referrals.png';
import linkImage from '../assets/link.png';

const SERVER_URL = 'http://45.153.69.251:8000';

const Referrals = ({ coins, onTaskComplete, completedTasks }) => {
  const [referrals, setReferrals] = useState([]);
  const [referralLink, setReferralLink] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');

    const baseUrl = window.location.origin;
    // Реферальная ссылка — передаём ?ref=наш userId, чтобы новый пользователь прописывался в "рефералах".
    if (userId) {
      setReferralLink(`${baseUrl}/?ref=${userId}`);
    }

    if (userId) {
      fetch(`${SERVER_URL}/getReferrals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      })
      .then(res => res.json())
      .then(data => {
        // data - список рефералов [{user_id, coins, best_score}]
        setReferrals(data);
      })
      .catch(err => console.error('Ошибка при получении рефералов:', err));
    }
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    alert('Реферальная ссылка скопирована в буфер обмена!');
  };

  return (
    <div className="referrals-container">
      <img src={referralProgramImage} alt="Реферальная программа" />
      <img src={inviteImage} alt="Пригласите друзей" className="invite-image" />

      <div className="referral-link">
        <div className="link-field">
          <img src={linkImage} alt="Реферальная ссылка" className="link-image" />
          <span className="link-text">{referralLink}</span>
        </div>
        <div className="copy-button" onClick={copyToClipboard}>
          <img src={copyImage} alt="Скопировать" />
        </div>
      </div>

      <img src={yourReferralsImage} alt="Ваши рефералы" className="your-referrals-image" />
      {referrals.length > 0 ? (
        <ul className="referrals-list">
          {referrals.map((ref) => (
            <li key={ref.user_id}>
              Пользователь {ref.user_id}: {ref.coins.toFixed(2)} монет, лучший круг — {ref.best_score}%
            </li>
          ))}
        </ul>
      ) : (
        <p className="no-referrals-message">У вас пока нет рефералов.</p>
      )}
    </div>
  );
};

export default Referrals;
