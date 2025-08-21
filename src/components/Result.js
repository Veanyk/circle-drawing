// src/components/Result.js
import React from 'react'; // без useRef/useEffect
import { TwitterShareButton } from 'react-share';
import './Result.css';

import tryAgainIcon from '../assets/try_again.png';
import twitterIcon from '../assets/twitter_icon.png';
import telegramIcon from '../assets/telegram_icon.png';
import shareResultsImage from '../assets/share_results.png';

const Result = ({ score, onReset, drawing, userId }) => {
  const BOT_USERNAME = 'circle_drawing_bot';
  const APP_SHORT_NAME = process.env.REACT_APP_TG_APP_SHORTNAME || 'circle_drawer';

  // корректный deep link (с поддержкой short name)
  const buildDeepLink = React.useCallback(() => {
    const base = APP_SHORT_NAME
      ? `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}`
      : `https://t.me/${BOT_USERNAME}`;
    return `${base}?startapp=ref_${userId}`;
  }, [userId, APP_SHORT_NAME]);

  const decimalTokens = (score / 100).toFixed(2);
  const shareText = `I drew a circle with ${Math.round(score)}% accuracy! Can you beat me?`;
  const shareUrl = buildDeepLink();

  // открыть нативный Telegram share (внутри Telegram) или t.me/share в браузере
  const handleShareTelegram = React.useCallback(
    (e) => {
      e.preventDefault();
      const url = buildDeepLink();
      const text = `I drew a circle with ${Math.round(score)}% accuracy! Can you beat me?`;
      const tgShare = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

      if (window?.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(tgShare);
      } else {
        window.open(tgShare, '_blank', 'noopener,noreferrer');
      }
    },
    [buildDeepLink, score]
  );

  // стиль для динамического круга через conic-gradient
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const circleStyle = React.useMemo(
    () => ({
      backgroundImage: `conic-gradient(#22c55e ${pct}%, #e5e7eb ${pct}% 100%)`,
    }),
    [pct]
  );

  return (
    <div className="result-container">
      {/* Текстовые итоги */}
      <p className="circle-accuracy-text">Your circle is {pct}% accurate</p>
      <p className="earned-tokens-text">You've earned {decimalTokens} tokens</p>

      {/* Ваш рисунок на доске.
          Динамический круг вынесен ВНУТРЬ этого блока, чтобы быть на том же фоне */}
      <div className="result-drawing-container">
        {/* Динамический круг процента — поверх доски */}
        <div className="result-circle-wrap" aria-label="Accuracy circle">
          <div className="result-circle-dynamic" style={circleStyle} />
          <div className="result-text-overlay">{pct}%</div>
          {/* Если нужен PNG-ободок — можно добавить <img className="result-circle-image" /> */}
        </div>

        {/* Сам рисунок пользователя */}
        <img src={drawing} alt="Your drawing" className="result-drawing-preview" />
      </div>

      {/* Кнопки */}
      <div className="buttons">
        <button className="reset-button" onClick={onReset} aria-label="Try again">
          <img src={tryAgainIcon} alt="Try again" className="button-icon" />
        </button>

        <div className="share-buttons">
          <img
            src={shareResultsImage}
            alt="Share results"
            className="share-results-image"
          />
          <div className="social-icons">
            <TwitterShareButton url={shareUrl} title={shareText}>
              {/* Twitter иконку делаем сильно меньше отдельным классом */}
              <img src={twitterIcon} alt="Twitter" className="social-icon twitter-icon" />
            </TwitterShareButton>

            <button
              type="button"
              className="social-icon-btn"
              onClick={handleShareTelegram}
              aria-label="Share on Telegram"
            >
              <img src={telegramIcon} alt="Telegram" className="social-icon" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Result;
