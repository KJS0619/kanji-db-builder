"use client";

import { useEffect, useCallback, useState } from "react";
import { Kanji, JLPT_COLORS } from "@/types/kanji";
import { StrokePlayer } from "./StrokePlayer";
import { DrawingCanvas } from "./DrawingCanvas";
import clsx from "clsx";

interface KanjiModalProps {
  kanji: Kanji;
  onClose: () => void;
}

type TabType = "stroke" | "draw";

export function KanjiModal({ kanji, onClose }: KanjiModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("stroke");

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // 배경 클릭으로 닫기
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-backdrop bg-black/50"
      onClick={handleBackdropClick}
    >
      <div
        className={clsx(
          "relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto",
          "bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl",
          "shadow-2xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <svg
            className="w-5 h-5 text-gray-600 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* 헤더 */}
        <div className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            {/* 한자 */}
            <div className="flex-shrink-0 w-24 h-24 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-xl">
              <span className="text-6xl font-bold text-gray-900 dark:text-white">
                {kanji.literal}
              </span>
            </div>

            {/* 기본 정보 */}
            <div className="flex-1 min-w-0">
              {/* 한국어 훈음 */}
              {kanji.korean_hun_eum && (
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-1">
                  {kanji.korean_hun_eum}
                </p>
              )}

              {/* 배지들 */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span
                  className={clsx(
                    "px-2 py-0.5 text-xs font-bold text-white rounded",
                    JLPT_COLORS[kanji.jlpt_level]
                  )}
                >
                  {kanji.jlpt_level}
                </span>
                <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                  {kanji.grade <= 6 ? `小${kanji.grade}` : "中学+"}
                </span>
                <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                  {kanji.stroke_count}획
                </span>
                {kanji.frequency && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                    #{kanji.frequency}
                  </span>
                )}
              </div>

              {/* Unicode */}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                U+{kanji.unicode_hex.toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* 독음 정보 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          {/* 음독 */}
          {kanji.ja_on.length > 0 && (
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-16 text-sm font-medium text-gray-500 dark:text-gray-400">
                音読み
              </span>
              <span className="text-sm text-gray-900 dark:text-white">
                {kanji.ja_on.join(", ")}
              </span>
            </div>
          )}

          {/* 훈독 */}
          {kanji.ja_kun.length > 0 && (
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-16 text-sm font-medium text-gray-500 dark:text-gray-400">
                訓読み
              </span>
              <span className="text-sm text-gray-900 dark:text-white">
                {kanji.ja_kun.join(", ")}
              </span>
            </div>
          )}

          {/* 영문 의미 */}
          {kanji.meanings_en.length > 0 && (
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-16 text-sm font-medium text-gray-500 dark:text-gray-400">
                English
              </span>
              <span className="text-sm text-gray-900 dark:text-white">
                {kanji.meanings_en.join(", ")}
              </span>
            </div>
          )}
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("stroke")}
            className={clsx(
              "flex-1 py-3 px-4 text-sm font-semibold transition-colors relative",
              activeTab === "stroke"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              획순 보기
            </span>
            {activeTab === "stroke" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("draw")}
            className={clsx(
              "flex-1 py-3 px-4 text-sm font-semibold transition-colors relative",
              activeTab === "draw"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              따라 쓰기
            </span>
            {activeTab === "draw" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
            )}
          </button>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="p-4">
          {activeTab === "stroke" && kanji.stroke_paths.length > 0 && (
            <StrokePlayer kanji={kanji} />
          )}

          {activeTab === "stroke" && kanji.stroke_paths.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              획순 데이터가 없습니다
            </div>
          )}

          {activeTab === "draw" && (
            <DrawingCanvas kanji={kanji} />
          )}
        </div>
      </div>
    </div>
  );
}
