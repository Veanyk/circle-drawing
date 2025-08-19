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
  const deepLink = `https://t.me/${BOT_USERNAME}?startapp=ref_${userId}`;
  const shareText = `I drew a circle with ${Math.round(score)}% accuracy! Can you beat me?`;
  const telegramShareUrl = deepLink; // телега открывает сразу мини-апп с параметром
  const shareUrl = `https://t.me/${BOT_USERNAME}?startapp=ref_${userId}`;

    // токены совпадают с логикой onDrawEnd (0.01 * score)
    const decimalTokens = (score / 100).toFixed(2);
    // формируем корректный deep link c учётом short name
    const buildDeepLink = React.useCallback(() => {
    const base = APP_SHORT_NAME
    ? `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}`
    : `https://t.me/${BOT_USERNAME}`;
    return `${base}?startapp=ref_${userId}`;
    }, [userId]);

    // открыть нативный Telegram share (внутри Telegram) или t.me/share в браузере
    const handleShareTelegram = React.useCallback((e) => {
    e.preventDefault();
    const url = buildDeepLink();
    const text = `I drew a circle with ${Math.round(score)}% accuracy! Can you beat me?`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

    if (window?.Telegram?.WebApp?.openTelegramLink) {
    window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
    }
    }, [buildDeepLink, score]);

    return (
    <div className="result-container">
      {/* ТОЛЬКО текстовые итоги — без второго круга */}
      <p className="circle-accuracy-text">
        Your circle is {Math.round(score)}% accurate
      </p>
      <p className="earned-tokens-text">
        You've earned {decimalTokens} tokens
      </p>

      {/* ваш рисунок */}
      <div className="result-drawing-container">
        <img src={drawing} alt="Your drawing" className="result-drawing-preview" />
      </div>

      <div className="buttons">
        <button className="reset-button" onClick={onReset}>
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
              <img src={twitterIcon} alt="Twitter" className="social-icon" />
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
