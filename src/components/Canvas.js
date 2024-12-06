import React, { useRef, useEffect, useState } from 'react';
import './Canvas.css';

const Canvas = ({ onDrawEnd, attempts }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState([]); // Хранение всех точек рисования

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Функция для установки размеров холста на основе его CSS-стилей
    const resizeCanvas = () => {
      const computedStyle = getComputedStyle(canvas);
      const width = parseInt(computedStyle.getPropertyValue('width'), 10);
      const height = parseInt(computedStyle.getPropertyValue('height'), 10);

      const scale = window.devicePixelRatio || 1;

      canvas.width = width * scale;
      canvas.height = height * scale;

      context.scale(scale, scale);

      context.lineWidth = 3;
      context.strokeStyle = '#ffffff';
      context.lineCap = 'round';
      context.lineJoin = 'round';
    };

    resizeCanvas();

    // Обработчик изменения размера окна
    window.addEventListener('resize', resizeCanvas);

    // Предотвращение прокрутки при касании холста на мобильных устройствах
    const preventDefault = (e) => {
      e.preventDefault();
    };

    canvas.addEventListener('touchstart', preventDefault, { passive: false });
    canvas.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('touchstart', preventDefault);
      canvas.removeEventListener('touchmove', preventDefault);
    };
  }, []);

  // Функция для получения позиции события
  const getEventPos = (event) => {
    if (event.touches && event.touches.length > 0) {
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: event.touches[0].clientX - rect.left,
        y: event.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: event.nativeEvent.offsetX,
        y: event.nativeEvent.offsetY,
      };
    }
  };

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
  };

  const draw = (event) => {
    if (!isDrawing) return;
    const { x, y } = getEventPos(event);
    const newPoints = [...points, { x, y }];
    setPoints(newPoints);

    const context = canvasRef.current.getContext('2d');

    // Расчёт точности для динамической смены цвета
    const accuracy = calculateAccuracy(newPoints);

    // Плавное изменение цвета от красного к зелёному + синий (неоновый оттенок)
    const red = Math.round(255 - (accuracy / 100) * 255);
    const green = Math.round((accuracy / 100) * 255);
    const blue = 255;
    context.strokeStyle = `rgb(${red},${green},${blue})`;

    context.lineTo(x, y);
    context.stroke();
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const rect = canvasRef.current.getBoundingClientRect();
    const score = calculateFinalScore(points);
    onDrawEnd(score, points, canvasRef.current, { width: rect.width, height: rect.height });
  };

  const calculateFinalScore = (allPoints) => {
    if (allPoints.length < 10) return 0;
    const accuracy = calculateAccuracy(allPoints);
    return Math.round(accuracy);
  };

  // Функция для оценки кругообразности
  const calculateAccuracy = (currentPoints) => {
    if (currentPoints.length < 10) return 0;
    const circle = fitCircle(currentPoints);
    if (!circle || isNaN(circle.radius) || circle.radius <= 0) return 0;

    const { centerX, centerY, radius } = circle;

    // Радиусы до каждой точки
    const radii = currentPoints.map((p) => Math.hypot(p.x - centerX, p.y - centerY));
    const avgRadius = radii.reduce((sum, r) => sum + r, 0) / radii.length;
    const radiusVariance = radii.reduce((sum, r) => sum + Math.pow(r - avgRadius, 2), 0) / radii.length;
    const radiusStdDev = Math.sqrt(radiusVariance);

    // Оценка равномерности радиуса
    const radiusUniformityScore = Math.max(0, 1 - (radiusStdDev / avgRadius));

    // Замкнутость
    const startPoint = currentPoints[0];
    const endPoint = currentPoints[currentPoints.length - 1];
    const distanceStartEnd = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
    const closureScore = 1 - Math.min(distanceStartEnd / (0.05 * radius), 1);

    // Угол охвата
    let totalAngleChange = 0;
    for (let i = 1; i < currentPoints.length - 1; i++) {
      const p0 = currentPoints[i - 1];
      const p1 = currentPoints[i];
      const p2 = currentPoints[i + 1];

      const angle1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const angle2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      let angleChange = angle2 - angle1;

      if (angleChange > Math.PI) angleChange -= 2 * Math.PI;
      else if (angleChange < -Math.PI) angleChange += 2 * Math.PI;

      totalAngleChange += angleChange;
    }
    const angleCoverage = Math.abs(totalAngleChange) / (2 * Math.PI);
    const angleCoverageScore = Math.min(angleCoverage, 1);

    // Равномерность распределения точек по углу
    const angles = currentPoints.map((p) => {
      return Math.atan2(p.y - centerY, p.x - centerX);
    }).sort((a, b) => a - b);

    for (let i = 0; i < angles.length; i++) {
      if (angles[i] < 0) angles[i] += 2 * Math.PI;
    }
    angles.sort((a, b) => a - b);

    const expectedSpacing = (2 * Math.PI) / angles.length;
    const angleDiffs = [];
    for (let i = 1; i < angles.length; i++) {
      angleDiffs.push(angles[i] - angles[i - 1]);
    }
    // Добавим разницу между последней и первой точкой, чтобы замкнуть круг
    angleDiffs.push((angles[0] + 2 * Math.PI) - angles[angles.length - 1]);

    const avgDiff = angleDiffs.reduce((sum, d) => sum + d, 0) / angleDiffs.length;
    const diffVariance = angleDiffs.reduce((sum, d) => sum + Math.pow(d - avgDiff, 2), 0) / angleDiffs.length;
    const diffStdDev = Math.sqrt(diffVariance);
    const angularUniformityScore = Math.max(0, 1 - (diffStdDev / (expectedSpacing / 2)));

    // Сглаженность
    let smoothnessScore = 1;
    const N = currentPoints.length;
    for (let i = 2; i < N; i++) {
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

    // Итоговая оценка
    const accuracy =
      radiusUniformityScore * 0.4 +
      closureScore * 0.2 +
      angleCoverageScore * 0.2 +
      angularUniformityScore * 0.1 +
      smoothnessScore * 0.1;

    return accuracy * 100;
  };

  // Функция для подгонки круга к точкам (алгоритм наименьших квадратов)
  const fitCircle = (points) => {
    let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumX3 = 0, sumY3 = 0, sumXY = 0, sumX1Y2 = 0, sumX2Y1 = 0;
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
      <p className="instructions">Нарисуйте круг как можно точнее!</p>
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
