// src/components/Result.js
import React, { useEffect, useRef } from 'react';
import { TwitterShareButton, TelegramShareButton } from 'react-share';
import './Result.css';

import resultCircleImage from '../assets/result_circle.png';
import tryAgainIcon from '../assets/try_again.png';
import twitterIcon from '../assets/twitter_icon.png';
import telegramIcon from '../assets/telegram_icon.png';
import shareResultsImage from '../assets/share_results.png';

const Result = ({ score, onReset, drawing }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    const userDrawing = new Image();
    userDrawing.src = drawing;
    userDrawing.onload = () => {
      canvas.width = userDrawing.width;
      canvas.height = userDrawing.height;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(userDrawing, 0, 0, canvas.width, canvas.height);
    };
  }, [drawing]);

  const shareUrl = 'https://t.me/circle_drawing_bot';
  const title = `Я нарисовал круг с точностью ${score}%! Попробуй и ты!`;

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
          alt="Результат"
          className="result-circle-image"
        />
        <div className="result-text-overlay">
          {score}%
        </div>
      </div>

      <p className="circle-accuracy-text">
        your circle is {score}% accurate
      </p>
      <p className="earned-tokens-text">
        you've earned {decimalTokens} tokens
      </p>

      <canvas ref={canvasRef} className="result-canvas" />

      <div className="buttons">
        <button className="reset-button" onClick={onReset}>
          <img src={tryAgainIcon} alt="Попробовать ещё раз" className="button-icon" />
        </button>

        <div className="share-buttons">
          <img
            src={shareResultsImage}
            alt="Поделиться результатом"
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
