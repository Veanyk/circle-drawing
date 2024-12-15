// src/components/Canvas.js
import React, { useRef, useEffect, useState } from 'react';
import chalkImage from '../assets/chalk.png';
import drawCircleImage from '../assets/draw_the_circle.png';
import drawingFieldImage from '../assets/drawing_field.png';
import './Canvas.css';

const Canvas = ({ onDrawEnd, attempts }) => {
  const canvasRef = useRef(null);
  const backgroundRef = useRef(null);

  // Состояния
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState([]);
  // Управляем стилями мела через объект chalkStyle
  const [chalkStyle, setChalkStyle] = useState({ display: 'none' });

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    const background = new Image();
    background.src = drawingFieldImage;
    background.onload = () => {
      backgroundRef.current = background;
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
    };

    // Функция подгонки размера canvas к размеру родительского контейнера
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      const computedStyle = getComputedStyle(container);
      const width = parseInt(computedStyle.getPropertyValue('width'), 10);

      const maxWidth = 500;
      const canvasWidth = Math.min(width * 0.8, maxWidth);
      const canvasHeight = canvasWidth; // Делаем канвас квадратным

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;

      // Очищаем канвас и рисуем фоновое изображение
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (backgroundRef.current) {
        context.drawImage(
          backgroundRef.current,
          0,
          0,
          canvas.width,
          canvas.height
        );
      }

      // Настройки кисти
      context.lineWidth = 3;
      context.strokeStyle = '#ffffff';
      context.lineCap = 'round';
      context.lineJoin = 'round';
    };

    // Предотвращаем прокрутку/скролл при тач-событиях на канвасе
    const preventDefault = (e) => e.preventDefault();
    canvas.addEventListener('touchstart', preventDefault, { passive: false });
    canvas.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('touchstart', preventDefault);
      canvas.removeEventListener('touchmove', preventDefault);
    };
  }, []);

  // Вычисляем координаты клика/касания на канвасе
  const getEventPos = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    let x, y;

    if (event.touches && event.touches.length > 0) {
      x = event.touches[0].clientX - rect.left;
      y = event.touches[0].clientY - rect.top;
    } else {
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    }

    return { x, y };
  };

  // Обновляем позицию мела, чтобы он отображался под курсором/касанием
  const updateChalkPosition = (event) => {
    // Позиция относительно всего окна (для fixed-элемента),
    // а не только относительно канваса
    let clientX, clientY;

    if (event.touches && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    setChalkStyle({
      display: 'block',
      left: `${clientX}px`,
      top: `${clientY - 30}px`,
    });
  };

  // Начало рисования
  const startDrawing = (event) => {
    if (attempts <= 0) {
      alert('У вас закончились попытки!');
      return;
    }

    const { x, y } = getEventPos(event);
    setIsDrawing(true);
    setPoints([{ x, y }]);

    const context = canvasRef.current.getContext('2d');
    context.beginPath();
    context.moveTo(x, y);

    updateChalkPosition(event);
  };

  // Рисование
  const draw = (event) => {
    if (!isDrawing) return;

    const { x, y } = getEventPos(event);
    setPoints((prevPoints) => [...prevPoints, { x, y }]);

    const context = canvasRef.current.getContext('2d');
    context.lineTo(x, y);
    context.stroke();

    updateChalkPosition(event);
  };

   // Завершение рисования
  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // Убираем мел с экрана
    setChalkStyle({ display: 'none' });

    const canvas = canvasRef.current;
    const score = calculateFinalScore(points);

    onDrawEnd(score, points, canvas, {
      width: canvas.width,
      height: canvas.height,
    });

    clearCanvas();
    setPoints([]);
  };

   // Очищаем канвас и восстанавливаем фоновое изображение
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (backgroundRef.current) {
      context.drawImage(
        backgroundRef.current,
        0,
        0,
        canvas.width,
        canvas.height
      );
    }
  };

  // Рассчитываем финальный счёт по массиву точек
  const calculateFinalScore = (allPoints) => {
    if (allPoints.length < 10) return 0;
    const accuracy = calculateAccuracy(allPoints);
    if (accuracy < 10) return 0;
    return Math.round(accuracy);
  };

   // Основная логика вычисления "точности круга"
  const calculateAccuracy = (currentPoints) => {
    if (currentPoints.length < 10) return 0;
    const circle = fitCircle(currentPoints);
    if (!circle || isNaN(circle.radius)) return 0;

    const { centerX, centerY, radius } = circle;
    const N = currentPoints.length;

    // Проверяем замкнутость: начало и конец должны быть достаточно близко
    const startPoint = currentPoints[0];
    const endPoint = currentPoints[currentPoints.length - 1];
    const distanceStartEnd = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
    const closureThreshold = 0.2 * radius;
    let closureScore = 1 - Math.min(distanceStartEnd / closureThreshold, 1);

    // Подсчёт углового охвата
    let totalAngleChange = 0;
    for (let i = 1; i < currentPoints.length - 1; i++) {
      const p0 = currentPoints[i - 1];
      const p1 = currentPoints[i];
      const p2 = currentPoints[i + 1];

      const angle1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const angle2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      let angleChange = angle2 - angle1;

      if (angleChange > Math.PI) angleChange -= 2 * Math.PI;
      if (angleChange < -Math.PI) angleChange += 2 * Math.PI;

      totalAngleChange += angleChange;
    }
    const angleCoverage = Math.abs(totalAngleChange) / (2 * Math.PI);
    const angleCoverageScore = Math.min(angleCoverage, 1);

    // Равномерность радиуса
    const radii = currentPoints.map((point) =>
      Math.hypot(point.x - centerX, point.y - centerY)
    );
    const avgRadius = radii.reduce((sum, r) => sum + r, 0) / radii.length;
    const radiusVariance = radii.reduce((sum, r) => sum + Math.pow(r - avgRadius, 2), 0) / radii.length;
    const radiusStdDev = Math.sqrt(radiusVariance);
    const radiusUniformity = Math.max(0, Math.min(1, 1 - radiusStdDev / avgRadius));

    // Пропорции (ширина/высота)
    const xValues = currentPoints.map((p) => p.x);
    const yValues = currentPoints.map((p) => p.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    const width = maxX - minX;
    const height = maxY - minY;
    const aspectRatio = width / height;
    const aspectRatioScore = Math.max(0, Math.min(1, 1 - Math.abs(aspectRatio - 1)));

    // Плавность
    let smoothnessScore = 1;
    for (let i = 2; i < currentPoints.length; i++) {
      const dx1 = currentPoints[i - 1].x - currentPoints[i - 2].x;
      const dy1 = currentPoints[i - 1].y - currentPoints[i - 2].y;
      const dx2 = currentPoints[i].x - currentPoints[i - 1].x;
      const dy2 = currentPoints[i].y - currentPoints[i - 1].y;
      const angle1 = Math.atan2(dy1, dx1);
      const angle2 = Math.atan2(dy2, dx2);
      let angleDiff = Math.abs(angle2 - angle1);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      smoothnessScore -= angleDiff / (Math.PI * N);
    }
    smoothnessScore = Math.max(0, smoothnessScore);

    // Итоговая формула
    let accuracy =
      radiusUniformity * 0.25 +
      aspectRatioScore * 0.15 +
      angleCoverageScore * 0.3 +
      closureScore * 0.25 +
      smoothnessScore * 0.05;

    // Если фигура совсем не замкнута
    if (closureScore < 0.55) {
      // просто сильно уменьшаем итог, но не до 0
      accuracy *= closureScore;
    }

    // Угловое покрытие: раньше было < 0.7 → 0; теперь «портим», но не обнуляем
    if (angleCoverage < 0.7) {
      accuracy *= angleCoverage;
    }

    // Равномерность радиуса: вместо < 0.3 → 0 теперь снижаем
    if (radiusUniformity < 0.3) {
      accuracy *= radiusUniformity;
    }

    // Убедимся, что не ушли в «отрицательные» значения
    accuracy = Math.max(0, accuracy);

    return accuracy * 100;
  };

  // Аппроксимируем координаты кругом
  const fitCircle = (points) => {
    let sumX = 0,
      sumY = 0,
      sumX2 = 0,
      sumY2 = 0,
      sumX3 = 0,
      sumY3 = 0,
      sumXY = 0,
      sumX1Y2 = 0,
      sumX2Y1 = 0;
    const N = points.length;

    for (let i = 0; i < N; i++) {
      const xi = points[i].x;
      const yi = points[i].y;
      const xi2 = xi * xi;
      const yi2 = yi * yi;
      sumX += xi;
      sumY += yi;
      sumX2 += xi2;
      sumY2 += yi2;
      sumX3 += xi2 * xi;
      sumY3 += yi2 * yi;
      sumXY += xi * yi;
      sumX1Y2 += xi * yi2;
      sumX2Y1 += xi2 * yi;
    }

    const C = N * sumX2 - sumX * sumX;
    const D = N * sumXY - sumX * sumY;
    const E = N * sumX3 + N * sumX1Y2 - (sumX2 + sumY2) * sumX;
    const G = N * sumY2 - sumY * sumY;
    const H = N * sumX2Y1 + N * sumY3 - (sumX2 + sumY2) * sumY;

    const denominator = 2 * (C * G - D * D);
    if (denominator === 0) {
      return null;
    }

    const a = (E * G - D * H) / denominator;
    const b = (C * H - D * E) / denominator;
    const c = -(sumX2 + sumY2 + a * sumX + b * sumY) / N;

    const centerX = -a;
    const centerY = -b;
    const radius = Math.sqrt(centerX * centerX + centerY * centerY - c);

    return { centerX, centerY, radius };
  };

  return (
    <div className="canvas-container">
      {/* Мел, который следует за курсором/касанием */}
      <img
        src={chalkImage}
        alt="Мел"
        className="chalk-image"
        style={chalkStyle}
      />

      {/* Подсказка: изображение "Нарисуйте круг" */}
      <img
        src={drawCircleImage}
        alt="Нарисуйте круг"
        className="draw-circle-image"
      />

      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={endDrawing}
      />
    </div>
  );
};

export default Canvas;
