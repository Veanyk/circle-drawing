import React, { useState, useEffect } from 'react';
import './Referrals.css';

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

  const handleInviteFriend = () => {
    // Симулируем приглашение друга
    alert('Вы пригласили друга!');
    if (!completedTasks.includes(3)) {
      onTaskComplete(3, 30);
      alert(`Вы получили 30 токенов за выполнение задания!`);
    }
  };

  return (
    <div className="referrals-container">
      <h3>Реферальная программа</h3>
      <p>Пригласите друзей и получайте 5% от их заработка!</p>
      <div className="referral-link">
        <input type="text" value={referralLink} readOnly />
        <button onClick={copyToClipboard}>Скопировать</button>
      </div>
      <button className="invite-button" onClick={handleInviteFriend}>Пригласить друга</button>
      <h4>Ваши рефералы:</h4>
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
