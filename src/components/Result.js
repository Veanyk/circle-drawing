import React from 'react'; // Убедитесь, что useRef и useEffect здесь НЕТ
import { TwitterShareButton, TelegramShareButton } from 'react-share';
import './Result.css';

import resultCircleImage from '../assets/result_circle.png';
import tryAgainIcon from '../assets/try_again.png';
import twitterIcon from '../assets/twitter_icon.png';
import telegramIcon from '../assets/telegram_icon.png';
import shareResultsImage from '../assets/share_results.png';

const Result = ({ score, onReset, drawing, userId }) => {
  const shareUrl = `${window.location.origin}?ref=${userId}`;
  const title = `I drew a circle with ${score}% accuracy! Can you beat me?`;

  const decimalTokens = (score / 100).toFixed(2);
  const angle = (score / 100) * 360;
  const circleStyle = {
    backgroundImage: `conic-gradient(#BE5200 ${angle}deg, #ffffff ${angle}deg 360deg)`,
  };

  return (
    <div className="result-container">
      <div className="result-image">
        <div className="result-circle-dynamic" style={circleStyle}></div>
        <img
          src={resultCircleImage}
          alt="Result"
          className="result-circle-image"
        />
        <div className="result-text-overlay">
          {score}%
        </div>
      </div>

      <p className="circle-accuracy-text">
        Your circle is {score}% accurate
      </p>
      <p className="earned-tokens-text">
        You've earned {decimalTokens} tokens
      </p>

      {/* Контейнер для вашего рисунка */}
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
            <TwitterShareButton url={shareUrl} title={title}>
              <img src={twitterIcon} alt="Twitter" className="social-icon" />
            </TwitterShareButton>
            <TelegramShareButton url={shareUrl} title={title}>
              <img src={telegramIcon} alt="Telegram" className="social-icon" />
            </TelegramShareButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Result;