// src/components/Result.js
import React, { useEffect, useRef } from 'react';
import { TwitterShareButton, TelegramShareButton } from 'react-share';
import './Result.css';
import tryAgainIcon from '../assets/try_again.png';
import resultCircleImage from '../assets/result_circle.png';
import twitterIcon from '../assets/twitter_icon.png';
import telegramIcon from '../assets/telegram_icon.png';

const Result = ({ score, onReset, drawing }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    const image = new Image();
    image.src = drawing;
    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height;

      const scale = window.devicePixelRatio || 1;
      if (scale > 1) {
        canvas.width = canvas.width * scale;
        canvas.height = canvas.height * scale;
        context.scale(scale, scale);
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width / scale, canvas.height / scale);
    };
  }, [drawing]);

  const shareUrl = 'https://t.me/circle_drawing_bot';
  const title = `Я нарисовал круг с точностью ${score}%! Попробуй и ты!`;

  return (
    <div className="result-container">
      <div className="result-image">
        <img src={resultCircleImage} alt="Результат" className="result-circle" />
        <div className="result-text-overlay">
          {score}%
        </div>
      </div>
      <h2 className="result-text">Ваш круг на {score}% точен!</h2>
      <p className="earned-coins">
        Вы заработали {(0.01 * score).toFixed(2)} токенов!
      </p>
      <canvas ref={canvasRef} className="result-canvas" />
      <div className="buttons">
        <button className="reset-button" onClick={onReset}>
          <img src={tryAgainIcon} alt="Попробовать ещё раз" className="button-icon" />
        </button>
        <div className="share-buttons">
          <h3>Поделиться результатом:</h3>
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
