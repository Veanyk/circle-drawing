import React, { useState, useEffect } from 'react';
import './Referrals.css';
import referralProgramImage from '../assets/referral_program.png';
import inviteImage from '../assets/invite.png';
import copyImage from '../assets/copy.png';
import yourReferralsImage from '../assets/your_referrals.png';
import linkImage from '../assets/link.png'; // Добавляем изображение link.png

const Referrals = ({ coins, onTaskComplete, completedTasks }) => {
  const [referrals, setReferrals] = useState(() => {
    const savedReferrals = localStorage.getItem('referrals');
    return savedReferrals ? JSON.parse(savedReferrals) : [];
  });

  const [referralLink, setReferralLink] = useState('');

  useEffect(() => {
    const baseUrl = window.location.origin;
    const userId = 'user123';
    setReferralLink(`${baseUrl}/?ref=${userId}`);
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    alert('Реферальная ссылка скопирована в буфер обмена!');
  };

  // Функция для получения данных о рефералах
  const fetchReferrals = () => {
    const dummyReferrals = [
      { id: 1, name: 'Реферал 1', tokensEarned: 50 },
      { id: 2, name: 'Реферал 2', tokensEarned: 30 },
    ];
    setReferrals(dummyReferrals);
  };

  useEffect(() => {
    fetchReferrals();
  }, []);

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
            <li key={ref.id}>
              {ref.name}: {ref.tokensEarned} токенов
            </li>
          ))}
        </ul>
      ) : (
        <p>У вас пока нет рефералов.</p>
      )}
    </div>
  );
};

export default Referrals;
