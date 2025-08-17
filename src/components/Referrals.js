import React, { useState, useEffect } from 'react';
import './Referrals.css';
import referralProgramImage from '../assets/referral_program.png';
import inviteImage from '../assets/invite.png';
import copyImage from '../assets/copy.png';
import yourReferralsImage from '../assets/your_referrals.png';
import linkImage from '../assets/link.png';

const SERVER_URL = 'https://draw-a-circle.chickenkiller.com';

const Referrals = ({ userId }) => {
  const [referrals, setReferrals] = useState([]);
  const [referralLink, setReferralLink] = useState('');

  // 1) Сформировать личную ссылку
  useEffect(() => {
    if (!userId) return;
    const baseUrl = window.location.origin;
    setReferralLink(`${baseUrl}/?ref=${userId}`);
  }, [userId]);

  // 2) Если мы пришли по чьей-то ссылке — добавить ТЕКУЩЕГО пользователя в список рефералов РЕФЕРЕРА
  useEffect(() => {
    if (!userId) return;
    const refId = new URLSearchParams(window.location.search).get('ref');

    // валидность + не считать самореферал
    if (!refId || refId === String(userId)) return;

    (async () => {
      try {
        // получаем данные реферера
        const r1 = await fetch(`${SERVER_URL}/getUserData`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: refId }),
        });
        const referrer = await r1.json();
        const list = Array.isArray(referrer?.referrals) ? referrer.referrals : [];

        // если этого пользователя ещё нет у реферера — добавляем
        if (!list.includes(userId)) {
          const updated = [...list, userId];
          await fetch(`${SERVER_URL}/updateUserData`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: refId, data: { referrals: updated } }),
          });
          // по желанию можно добавить вознаграждение рефереру тут
        }
      } catch (e) {
        console.error('Ошибка добавления реферала:', e);
      }
    })();
  }, [userId]);

  // 3) Мои рефералы для списка (автообновление)
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
        if (!stop) setReferrals(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Ошибка при получении рефералов:', e);
      }
    };

    loadMyRefs();
    const t = setInterval(loadMyRefs, 30000);
    return () => { stop = true; clearInterval(t); };
  }, [userId]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      alert('Referral link copied to clipboard!');
    } catch {
      // fallback
      const area = document.createElement('textarea');
      area.value = referralLink; document.body.appendChild(area);
      area.select(); document.execCommand('copy'); area.remove();
      alert('Referral link copied to clipboard!');
    }
  };

  return (
    <div className="referrals-container">
      <img src={referralProgramImage} alt="Referral Program" className="r-title" />
      <img src={inviteImage} alt="Invite friends" className="invite-image" />

      <div className="referral-link">
        <div className="link-field">
          <img src={linkImage} alt="Referral link" className="link-image" />
          <span className="link-text">{referralLink}</span>
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

            // Отображаем username, если он есть, иначе - ID
            const displayName = ref.username || ref.user_id;

            return (
            <li key={ref.user_id} className="ref-item">
              <span className="ref-name">{displayName}</span>
              <span className="ref-stats">{coins} coins • best {best}%</span>
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
