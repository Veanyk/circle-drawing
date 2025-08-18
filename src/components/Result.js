import React from 'react'; // Убедитесь, что useRef и useEffect здесь НЕТ
import { TwitterShareButton, TelegramShareButton } from 'react-share';
import './Result.css';

import resultCircleImage from '../assets/result_circle.png';
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
  const circleStyle = {
    backgroundImage: `conic-gradient(#BE5200 ${angle}deg, #ffffff ${angle}deg 360deg)`,
  };

return (
  <div className="result-container">
    <div className="result-image result-image--floating" aria-hidden="true">
      <div className="result-circle-dynamic" style={circleStyle} />
      <img src={resultCircleImage} alt="" className="result-circle-image" draggable="false" />
      <div className="result-text-overlay">{Math.round(score)}%</div>
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
            {/* Twitter использует простую ссылку и текст */}
            <TwitterShareButton url={simpleRefLink} title={shareText}>
              <img src={twitterIcon} alt="Twitter" className="social-icon" />
            </TwitterShareButton>
            {/* Для Telegram мы используем нашу специальную ссылку, чтобы передать оба параметра */}
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