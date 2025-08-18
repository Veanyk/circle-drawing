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
  const deepLink = `https://t.me/${BOT_USERNAME}?startapp=ref_${userId}`;
  const shareText = `I drew a circle with ${Math.round(score)}% accuracy! Can you beat me?`;
  const telegramShareUrl = deepLink; // телега открывает сразу мини-апп с параметром
  const shareUrl = `https://t.me/${BOT_USERNAME}?startapp=ref_${userId}`;

  // токены совпадают с логикой onDrawEnd (0.01 * score)
  const decimalTokens = (score / 100).toFixed(2);

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
