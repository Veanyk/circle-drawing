// src/components/Result.js
import React from 'react';
import { TwitterShareButton } from 'react-share';
import './Result.css';

import tryAgainIcon from '../assets/try_again.png';
import twitterIcon from '../assets/twitter_icon.png';
import telegramIcon from '../assets/telegram_icon.png';
import shareResultsImage from '../assets/share_results.png';

function ScoreRing({ value, size = 160, thickness = 14, radiusDelta = 5, color = '#C85A0A' }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const c = size / 2;
  const r = c - thickness / 2 - radiusDelta; // радиус меньше на 5 px
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Белый диск, полностью закрашивает внутреннюю область */}
        <circle cx={c} cy={c} r={r - thickness / 2} fill="#fff" />

        {/* Рыжая дуга прогресса – только обводка */}
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${c} ${c})`} // старт сверху
        />
      </svg>

      {/* Процент по центру круга */}
      <div className="score-ring__label">{pct}%</div>
    </div>
  );
}

const Result = ({ score, onReset, drawing, userId }) => {
  const BOT_USERNAME = 'circle_drawing_bot';
  const deepLink = `https://t.me/${BOT_USERNAME}?startapp=ref_${userId}`;
  const shareText = `I drew a circle with ${Math.round(score)}% accuracy! Can you beat me?`;

  // FIX: здесь раньше был ReferenceError из-за simpleRefLink
  const simpleRefLink = `${window.location.origin}?ref=${userId ?? ''}`;

  const decimalTokens = (score / 100).toFixed(2);

  return (
    <div className="result-container">
      {/* Круг с процентом внутри */}
      <ScoreRing value={score} size={160} thickness={14} radiusDelta={5} />

      <p className="circle-accuracy-text">
        Your circle is {Math.round(score)}% accurate
      </p>
      <p className="earned-tokens-text">
        You've earned {decimalTokens} tokens
      </p>

      <div className="result-drawing-container">
        {drawing && <img src={drawing} alt="Your drawing" className="result-drawing-preview" />}
      </div>

      <div className="buttons">
        <button className="reset-button" onClick={onReset}>
          <img src={tryAgainIcon} alt="Try again" className="button-icon" />
        </button>

        <div className="share-buttons">
          <img src={shareResultsImage} alt="Share results" className="share-results-image" />
          <div className="social-icons">
            <TwitterShareButton url={simpleRefLink} title={shareText}>
              <img src={twitterIcon} alt="Twitter" className="social-icon" />
            </TwitterShareButton>
            <a href={deepLink} target="_blank" rel="noopener noreferrer">
              <img src={telegramIcon} alt="Telegram" className="social-icon" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Result;
