// src/components/Result.js
import React from 'react';
import { TwitterShareButton } from 'react-share';
import './Result.css';

import tryAgainIcon from '../assets/try_again.png';
import twitterIcon from '../assets/twitter_icon.png';
import telegramIcon from '../assets/telegram_icon.png';
import shareResultsImage from '../assets/share_results.png';

const ScoreCircle = ({ score }) => {
  const s = Number(score) || 0;
  const clamped = Math.min(100, Math.max(0, s));
  const angle = (clamped / 100) * 360;
  const circleStyle = {
    backgroundImage: `conic-gradient(#BE5200 ${angle}deg, #ffffff ${angle}deg 360deg)`,
  };
  // локально подтянем PNG, чтобы не трогать импорты файла
  const resultCircleImage = require('../assets/result_circle.png');

  return (
    <div className="score-circle-header">
      <div className="score-circle-dynamic" style={circleStyle} />
      <img src={resultCircleImage} alt="Result" className="score-circle-image" />
      <div className="score-circle-text">{Math.round(clamped)}%</div>
    </div>
  );
};
// Result.js — ЗАМЕНИ компонент Result на эту версию (без рисованного круга поверх доски)
const Result = ({ score, onReset, drawing, userId }) => {
  const BOT_USERNAME = 'circle_drawing_bot';
  const APP_SHORT_NAME = process.env.REACT_APP_TG_APP_SHORTNAME || 'circle_drawer';

  const buildDeepLink = React.useCallback(() => {
    const base = APP_SHORT_NAME
      ? `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}`
      : `https://t.me/${BOT_USERNAME}`;
    return `${base}?startapp=ref_${userId}`;
  }, [userId, APP_SHORT_NAME]);

  const decimalTokens = (score / 100).toFixed(2);
  const shareText = `I drew a circle with ${Math.round(score)}% accuracy! Can you beat me?`;
  const shareUrl = buildDeepLink();

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

  const pct = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <div className="result-container">
      {/* Круг результата в шапке (PNG + градиент) */}
      <ScoreCircle score={pct} />

      <p className="circle-accuracy-text">Your circle is {pct}% accurate</p>
      <p className="earned-tokens-text">You've earned {decimalTokens} tokens</p>

      {/* Показываем ГОТОВЫЙ снимок холста (без дополнительного круга поверх доски) */}
      <div className="result-drawing-container">
        <img src={drawing} alt="Your drawing" className="result-drawing-image" />
      </div>

      <div className="buttons">
        <button className="reset-button" onClick={onReset} aria-label="Try again">
          <img src={tryAgainIcon} alt="Try again" className="button-icon" />
        </button>

        <div className="share-buttons">
          <img src={shareResultsImage} alt="Share results" className="share-results-image" />
          <div className="social-icons">
            <TwitterShareButton url={shareUrl} title={shareText}>
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
