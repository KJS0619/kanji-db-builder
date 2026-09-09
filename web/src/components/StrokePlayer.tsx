"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Kanji } from "@/types/kanji";
import clsx from "clsx";

interface StrokePlayerProps {
  kanji: Kanji;
}

type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;

// 속도별 획당 애니메이션 시간 (ms)
const SPEED_DURATION: Record<PlaybackSpeed, number> = {
  0.5: 1000,
  1: 500,
  1.5: 350,
  2: 250,
};

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 1, 1.5, 2];

export function StrokePlayer({ kanji }: StrokePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStroke, setCurrentStroke] = useState(-1);
  const [showNumbers, setShowNumbers] = useState(true);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [completedStrokes, setCompletedStrokes] = useState<number[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pausedAtRef = useRef<number>(-1);

  const strokeCount = kanji.stroke_paths.length;

  // 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // 다음 획으로 진행
  const animateStroke = useCallback((index: number) => {
    if (index >= strokeCount) {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentStroke(-1);
      setCompletedStrokes(kanji.stroke_paths.map((_, i) => i));
      return;
    }

    setCurrentStroke(index);

    timerRef.current = setTimeout(() => {
      setCompletedStrokes((prev) => [...prev, index]);
      animateStroke(index + 1);
    }, SPEED_DURATION[speed]);
  }, [strokeCount, speed, kanji.stroke_paths]);

  // 재생 시작
  const handlePlay = useCallback(() => {
    if (isPaused) {
      setIsPaused(false);
      setIsPlaying(true);
      animateStroke(pausedAtRef.current);
    } else if (!isPlaying) {
      setIsPlaying(true);
      setIsPaused(false);
      setCompletedStrokes([]);
      setCurrentStroke(0);

      timerRef.current = setTimeout(() => {
        animateStroke(0);
      }, 50);
    }
  }, [isPlaying, isPaused, animateStroke]);

  // 일시정지
  const handlePause = useCallback(() => {
    if (isPlaying && !isPaused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsPlaying(false);
      setIsPaused(true);
      pausedAtRef.current = currentStroke >= 0 ? currentStroke : 0;
    }
  }, [isPlaying, isPaused, currentStroke]);

  // 처음부터 다시 재생
  const handleReplay = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPlaying(true);
    setIsPaused(false);
    setCurrentStroke(-1);
    setCompletedStrokes([]);
    pausedAtRef.current = -1;

    timerRef.current = setTimeout(() => {
      setCurrentStroke(0);
      animateStroke(0);
    }, 100);
  }, [animateStroke]);

  // 속도 변경
  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      const idx = SPEED_OPTIONS.indexOf(prev);
      return SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* SVG 캔버스 영역 */}
      <div className="relative mx-auto w-56 h-56 sm:w-64 sm:h-64 bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-300 dark:border-gray-600 shadow-inner">
        <svg viewBox="0 0 109 109" className="w-full h-full">
          {/* 십자 가이드 라인 */}
          <line x1="54.5" y1="0" x2="54.5" y2="109" stroke="#d1d5db" strokeWidth="0.5" strokeDasharray="3,3" />
          <line x1="0" y1="54.5" x2="109" y2="54.5" stroke="#d1d5db" strokeWidth="0.5" strokeDasharray="3,3" />

          {/* 배경 가이드: 모든 획을 연한 회색으로 */}
          {kanji.stroke_paths.map((stroke, i) => (
            <path
              key={`bg-${i}`}
              d={stroke.path}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* 완료된 획 */}
          {completedStrokes.map((i) => (
            <path
              key={`done-${i}`}
              d={kanji.stroke_paths[i].path}
              fill="none"
              stroke="#1f2937"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="dark:stroke-white"
            />
          ))}

          {/* 현재 애니메이션 중인 획 */}
          {currentStroke >= 0 && currentStroke < strokeCount && !isPaused && (
            <AnimatedStroke
              key={`anim-${currentStroke}-${speed}`}
              path={kanji.stroke_paths[currentStroke].path}
              duration={SPEED_DURATION[speed]}
            />
          )}

          {/* 일시정지 중인 획 */}
          {isPaused && currentStroke >= 0 && currentStroke < strokeCount && (
            <path
              d={kanji.stroke_paths[currentStroke].path}
              fill="none"
              stroke="#dc2626"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* 획순 번호 뱃지 */}
          {showNumbers && kanji.stroke_paths.map((stroke, i) => {
            const isCompleted = completedStrokes.includes(i);
            const isCurrent = currentStroke === i;

            return (
              <g key={`num-${i}`}>
                <circle
                  cx={stroke.start_x}
                  cy={stroke.start_y}
                  r="3.5"
                  fill={isCompleted ? "#2563eb" : isCurrent ? "#dc2626" : "#9ca3af"}
                  stroke="white"
                  strokeWidth="1"
                />
                <text
                  x={stroke.start_x}
                  y={stroke.start_y + 0.3}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize="4"
                  fontWeight="bold"
                >
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>

        {/* 진행 상태 */}
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white font-mono">
          {completedStrokes.length}/{strokeCount}획
        </div>
      </div>

      {/* 컨트롤러 버튼 바 */}
      <div className="flex flex-wrap items-center justify-center gap-2 px-2">
        {/* 재생 / 일시정지 */}
        {isPlaying ? (
          <button
            onClick={handlePause}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-md"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            일시정지
          </button>
        ) : (
          <button
            onClick={handlePlay}
            className={clsx(
              "flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-md",
              isPaused
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            )}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            {isPaused ? "계속" : "▶ 재생"}
          </button>
        )}

        {/* 처음부터 */}
        <button
          onClick={handleReplay}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gray-600 hover:bg-gray-700 text-white transition-colors shadow-md"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          처음부터
        </button>

        {/* 획번호 토글 */}
        <button
          onClick={() => setShowNumbers((v) => !v)}
          className={clsx(
            "flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-md",
            showNumbers
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          )}
        >
          <span className="text-base font-bold">123</span>
          획번호
        </button>

        {/* 속도 조절 */}
        <button
          onClick={cycleSpeed}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-md min-w-[80px] justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {speed}x
        </button>
      </div>
    </div>
  );
}

// 애니메이션 획 컴포넌트
function AnimatedStroke({ path, duration }: { path: string; duration: number }) {
  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (pathRef.current) {
      const len = pathRef.current.getTotalLength();
      setLength(len);
      requestAnimationFrame(() => setIsReady(true));
    }
  }, [path]);

  return (
    <path
      ref={pathRef}
      d={path}
      fill="none"
      stroke="#dc2626"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        strokeDasharray: length || 1000,
        strokeDashoffset: isReady ? 0 : (length || 1000),
        transition: isReady ? `stroke-dashoffset ${duration}ms ease-out` : 'none',
      }}
    />
  );
}
