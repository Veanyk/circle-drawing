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
  const circleStyle = { backgroundImage: `conic-gradient(#BE5200 ${angle}deg, transparent ${angle}deg 360deg)` };
  const resultCircleImage = require('../assets/result_circle.png');

  return (
    <div className="result-score-circle">
      <div className="score-circle-dynamic" style={circleStyle} />
      <img src={resultCircleImage} alt="Result" className="score-circle-image" />
      <div className="score-circle-text">{Math.round(clamped)}%</div>
    </div>
  );
};

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
  const pct = Math.max(0, Math.min(100, Math.round(score)));

  const handleShareTelegram = React.useCallback((e) => {
    e.preventDefault();
    const url = buildDeepLink();
    const text = `I drew a circle with ${Math.round(score)}% accuracy! Can you beat me?`;
    const tgShare = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    if (window?.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(tgShare);
    } else {
      window.open(tgShare, '_blank', 'noopener,noreferrer');
    }
  }, [buildDeepLink, score]);

  return (
    <div className="result-container">
      <div className="top-section">
        <ScoreCircle score={pct} />
      </div>

      <p className="circle-accuracy-text">Your circle is {pct}% accurate</p>
      <p className="earned-tokens-text">You've earned {decimalTokens} tokens</p>

      <div className="result-drawing-container">
        <img src={drawing} alt="Your drawing" className="result-drawing-image board-size" />
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
              className="social-icon-btn telegram"
              onClick={handleShareTelegram}
              aria-label="Share on Telegram"
            >
              <img src={telegramIcon} alt="Telegram" className="social-icon" />
            </button>
          </div>
        </div>
      </div>

      <div className="bottom-scroll-spacer" aria-hidden="true" />
      <div className="extra-scroll-space" aria-hidden="true" />
    </div>
    </div>
  );
};

export default Result;
