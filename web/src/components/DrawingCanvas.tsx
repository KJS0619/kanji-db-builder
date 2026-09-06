"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Kanji } from "@/types/kanji";

interface DrawingCanvasProps {
  kanji: Kanji;
}

export function DrawingCanvas({ kanji }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  // 캔버스 크기
  const canvasSize = 224; // 56 * 4 for retina

  // 좌표 계산 헬퍼
  const getCoordinates = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      let clientX: number, clientY: number;

      if ("touches" in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    []
  );

  // 가이드 그리기
  const drawGuide = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 캔버스 클리어
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showGuide || kanji.stroke_paths.length === 0) return;

    // 스케일 설정 (109 -> canvasSize)
    const scale = canvasSize / 109;

    ctx.save();
    ctx.scale(scale, scale);

    // 가이드 라인 (십자선)
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);

    ctx.beginPath();
    ctx.moveTo(54.5, 0);
    ctx.lineTo(54.5, 109);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 54.5);
    ctx.lineTo(109, 54.5);
    ctx.stroke();

    ctx.setLineDash([]);

    // 획 가이드 (연한 회색)
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    kanji.stroke_paths.forEach((stroke) => {
      const path = new Path2D(stroke.path);
      ctx.stroke(path);
    });

    ctx.restore();
  }, [kanji.stroke_paths, showGuide]);

  // 초기 가이드 그리기
  useEffect(() => {
    drawGuide();
  }, [drawGuide]);

  // 그리기 시작
  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const coords = getCoordinates(e);
      if (!coords) return;

      setIsDrawing(true);

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    },
    [getCoordinates]
  );

  // 그리기 중
  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return;

      const coords = getCoordinates(e);
      if (!coords) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    },
    [isDrawing, getCoordinates]
  );

  // 그리기 종료
  const handleEnd = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // 클리어
  const handleClear = useCallback(() => {
    drawGuide();
  }, [drawGuide]);

  // 가이드 토글
  const handleToggleGuide = useCallback(() => {
    setShowGuide((v) => !v);
  }, []);

  useEffect(() => {
    drawGuide();
  }, [showGuide, drawGuide]);

  return (
    <div className="space-y-3">
      {/* 캔버스 */}
      <div className="relative mx-auto w-56 h-56 bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-300 dark:border-gray-600 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          className="w-full h-full touch-none"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
      </div>

      {/* 컨트롤 */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          지우기
        </button>

        <button
          onClick={handleToggleGuide}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showGuide
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          }`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          가이드
        </button>
      </div>
    </div>
  );
}
