"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Kanji, StrokePath } from "@/types/kanji";
import clsx from "clsx";

interface StrokeRendererProps {
  kanji: Kanji;
}

export function StrokeRenderer({ kanji }: StrokeRendererProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStroke, setCurrentStroke] = useState(-1);
  const [showNumbers, setShowNumbers] = useState(true);
  const [completedStrokes, setCompletedStrokes] = useState<number[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const strokeCount = kanji.stroke_paths.length;

  // 애니메이션 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // 재생 시작
  const handlePlay = useCallback(() => {
    if (isPlaying) return;

    setIsPlaying(true);
    setCompletedStrokes([]);
    setCurrentStroke(0);

    const animateNext = (index: number) => {
      if (index >= strokeCount) {
        setIsPlaying(false);
        setCurrentStroke(-1);
        setCompletedStrokes(kanji.stroke_paths.map((_, i) => i));
        return;
      }

      timerRef.current = setTimeout(() => {
        setCompletedStrokes((prev) => [...prev, index]);
        setCurrentStroke(index + 1);
        animateNext(index + 1);
      }, 600);
    };

    timerRef.current = setTimeout(() => {
      animateNext(0);
    }, 100);
  }, [isPlaying, strokeCount, kanji.stroke_paths]);

  // 리셋
  const handleReset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPlaying(false);
    setCurrentStroke(-1);
    setCompletedStrokes([]);
  }, []);

  return (
    <div className="space-y-3">
      {/* SVG 영역 */}
      <div className="relative mx-auto w-48 h-48 sm:w-56 sm:h-56 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700">
        <svg
          viewBox="0 0 109 109"
          className="w-full h-full"
          style={{ overflow: "visible" }}
        >
          {/* 가이드 그리드 */}
          <line
            x1="54.5"
            y1="0"
            x2="54.5"
            y2="109"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-gray-300 dark:text-gray-600"
            strokeDasharray="2,2"
          />
          <line
            x1="0"
            y1="54.5"
            x2="109"
            y2="54.5"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-gray-300 dark:text-gray-600"
            strokeDasharray="2,2"
          />

          {/* 미완료 획 (회색 가이드) */}
          {kanji.stroke_paths.map((stroke, i) => {
            const isCompleted = completedStrokes.includes(i);
            const isCurrent = currentStroke === i;

            if (isCompleted || isCurrent) return null;

            return (
              <path
                key={`guide-${i}`}
                d={stroke.path}
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-300 dark:text-gray-600"
              />
            );
          })}

          {/* 완료된 획 */}
          {completedStrokes.map((i) => (
            <path
              key={`completed-${i}`}
              d={kanji.stroke_paths[i].path}
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-800 dark:text-gray-200"
            />
          ))}

          {/* 현재 그려지는 획 (애니메이션) */}
          {currentStroke >= 0 && currentStroke < strokeCount && (
            <AnimatedStroke
              path={kanji.stroke_paths[currentStroke].path}
              key={`anim-${currentStroke}`}
            />
          )}

          {/* 획순 번호 */}
          {showNumbers &&
            kanji.stroke_paths.map((stroke, i) => (
              <g key={`num-${i}`}>
                <circle
                  cx={stroke.start_x}
                  cy={stroke.start_y}
                  r="6"
                  className={clsx(
                    completedStrokes.includes(i)
                      ? "fill-blue-500"
                      : currentStroke === i
                      ? "fill-red-500"
                      : "fill-gray-400 dark:fill-gray-500"
                  )}
                />
                <text
                  x={stroke.start_x}
                  y={stroke.start_y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-white text-[7px] font-bold"
                >
                  {i + 1}
                </text>
              </g>
            ))}
        </svg>
      </div>

      {/* 컨트롤 버튼 */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={handlePlay}
          disabled={isPlaying}
          className={clsx(
            "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            isPlaying
              ? "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          )}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
          재생
        </button>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          리셋
        </button>

        <button
          onClick={() => setShowNumbers((v) => !v)}
          className={clsx(
            "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            showNumbers
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          )}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
          번호
        </button>
      </div>
    </div>
  );
}

// 애니메이션 획 컴포넌트
function AnimatedStroke({ path }: { path: string }) {
  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      const len = pathRef.current.getTotalLength();
      setLength(len);
    }
  }, [path]);

  return (
    <path
      ref={pathRef}
      d={path}
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-red-500"
      style={{
        strokeDasharray: length,
        strokeDashoffset: length,
        animation: "draw-stroke 0.5s ease-out forwards",
        ["--stroke-length" as string]: length,
      }}
    />
  );
}
