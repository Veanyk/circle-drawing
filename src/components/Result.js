// src/components/Result.js
import React from 'react';
import { TwitterShareButton } from 'react-share';
import './Result.css';

import resultCircleImage from '../assets/result_circle.png';
import drawCircleImage from '../assets/draw_the_circle.png'; // 👈 добавили
import tryAgainIcon from '../assets/try_again.png';
import twitterIcon from '../assets/twitter_icon.png';
import telegramIcon from '../assets/telegram_icon.png';
import shareResultsImage from '../assets/share_results.png';

const Result = ({ score, onReset, drawing, userId }) => {
  const simpleRefLink = `${window.location.origin}?ref=${userId}`;
  const shareText = `I drew a circle with ${score}% accuracy! Can you beat me?`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(simpleRefLink)}&text=${encodeURIComponent(shareText)}`;

  const decimalTokens = (score / 100).toFixed(2);
  const angle = (score / 100) * 360;

  return (
    <div className="result-container">
      {/* СПЕЙСЕР той же высоты, что подсказка над канвасом на Canvas-странице */}
      <div className="result-header-spacer">
        <img
          src={drawCircleImage}
          alt=""
          className="draw-circle-image"
          aria-hidden="true"
        />
        {/* компактный бейдж в правом нижнем углу “подсказки” */}
          <div className="result-badge">
            <div className="result-badge-base" />
            <div className="result-badge-arc" style={{ '--deg': `${angle}deg` }} />
            <div className="result-badge-text">{Math.round(score)}%</div>
          </div>
        </div>

      {/* Превью рисунка — та же геометрия, что и у канваса */}
      <div className="result-drawing-container">
        <img src={drawing} alt="Your drawing" className="result-drawing-preview" />
      </div>

      {/* Кнопки */}
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
            <TwitterShareButton url={simpleRefLink} title={shareText}>
              <img src={twitterIcon} alt="Twitter" className="social-icon" />
            </TwitterShareButton>
            <a href={telegramShareUrl} target="_blank" rel="noopener noreferrer">
              <img src={telegramIcon} alt="Telegram" className="social-icon" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Result;
