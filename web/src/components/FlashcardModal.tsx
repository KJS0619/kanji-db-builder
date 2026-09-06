"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
import { Kanji, JLPT_COLORS } from "@/types/kanji";
import clsx from "clsx";

interface FlashcardModalProps {
  kanjiList: Kanji[];
  onClose: () => void;
}

type JlptTab = "N5" | "N4" | "N3" | "N2" | "N1";

const JLPT_TABS: JlptTab[] = ["N5", "N4", "N3", "N2", "N1"];

// Fisher-Yates 셔플 알고리즘
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function FlashcardModal({ kanjiList, onClose }: FlashcardModalProps) {
  const [selectedLevel, setSelectedLevel] = useState<JlptTab>("N5");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [deck, setDeck] = useState<Kanji[]>([]);

  // 등급별 한자 필터링
  const filteredByLevel = useMemo(() => {
    return kanjiList.filter((k) => k.jlpt_level === selectedLevel);
  }, [kanjiList, selectedLevel]);

  // 등급별 카운트
  const levelCounts = useMemo(() => {
    const counts: Record<JlptTab, number> = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 };
    kanjiList.forEach((k) => {
      if (counts[k.jlpt_level as JlptTab] !== undefined) {
        counts[k.jlpt_level as JlptTab]++;
      }
    });
    return counts;
  }, [kanjiList]);

  // 초기 덱 셔플
  useEffect(() => {
    setDeck(shuffleArray(filteredByLevel));
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [filteredByLevel]);

  // 덱 셔플
  const handleShuffle = useCallback(() => {
    setDeck(shuffleArray(filteredByLevel));
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [filteredByLevel]);

  // 카드 뒤집기
  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  // 다음 카드
  const handleNext = useCallback(() => {
    if (currentIndex < deck.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    }
  }, [currentIndex, deck.length]);

  // 이전 카드
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  // 등급 변경
  const handleLevelChange = useCallback((level: JlptTab) => {
    setSelectedLevel(level);
  }, []);

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case " ":
        case "Enter":
          e.preventDefault();
          handleFlip();
          break;
        case "ArrowLeft":
          handlePrev();
          break;
        case "ArrowRight":
          handleNext();
          break;
        case "r":
        case "R":
          handleShuffle();
          break;
        case "Escape":
          onClose();
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFlip, handlePrev, handleNext, handleShuffle, onClose]);

  // 배경 클릭으로 닫기
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const currentKanji = deck[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/60"
      onClick={handleBackdropClick}
    >
      <div
        className={clsx(
          "relative w-full max-w-md mx-4 sm:mx-0",
          "bg-white dark:bg-gray-900 rounded-2xl",
          "shadow-2xl overflow-hidden"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🎴</span>
            플래시카드
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
        </div>

        {/* JLPT 등급 탭 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {JLPT_TABS.map((level) => (
            <button
              key={level}
              onClick={() => handleLevelChange(level)}
              className={clsx(
                "flex-1 py-2.5 text-sm font-semibold transition-all relative",
                selectedLevel === level
                  ? "text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <span className="relative z-10">{level}</span>
              <span
                className={clsx(
                  "ml-1 text-xs relative z-10",
                  selectedLevel === level ? "text-white/80" : "text-gray-400"
                )}
              >
                ({levelCounts[level]})
              </span>
              {selectedLevel === level && (
                <div
                  className={clsx(
                    "absolute inset-0",
                    JLPT_COLORS[level]
                  )}
                />
              )}
            </button>
          ))}
        </div>

        {/* 진행률 & 셔플 */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {deck.length > 0 ? currentIndex + 1 : 0} / {deck.length}
            </span>
            {/* 프로그레스 바 */}
            <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={clsx("h-full transition-all", JLPT_COLORS[selectedLevel])}
                style={{
                  width: deck.length > 0 ? `${((currentIndex + 1) / deck.length) * 100}%` : "0%",
                }}
              />
            </div>
          </div>
          <button
            onClick={handleShuffle}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            섞기
          </button>
        </div>

        {/* 플래시카드 */}
        {deck.length > 0 && currentKanji ? (
          <div className="p-6">
            <div
              className="flashcard-container w-full h-64 sm:h-72 cursor-pointer"
              onClick={handleFlip}
            >
              <div className={clsx("flashcard w-full h-full", isFlipped && "flipped")}>
                {/* 앞면 - 한자 */}
                <div
                  className={clsx(
                    "flashcard-face flex flex-col items-center justify-center",
                    "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900",
                    "border-2 border-gray-200 dark:border-gray-700",
                    "shadow-lg"
                  )}
                >
                  <span
                    className={clsx(
                      "text-8xl sm:text-9xl font-bold text-gray-900 dark:text-white",
                      "select-none"
                    )}
                  >
                    {currentKanji.literal}
                  </span>
                  <div className="mt-4 flex items-center gap-2">
                    <span
                      className={clsx(
                        "px-2 py-0.5 text-xs font-bold text-white rounded",
                        JLPT_COLORS[currentKanji.jlpt_level]
                      )}
                    >
                      {currentKanji.jlpt_level}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {currentKanji.stroke_count}획
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">
                    클릭하여 뒤집기
                  </p>
                </div>

                {/* 뒷면 - 정보 */}
                <div
                  className={clsx(
                    "flashcard-face flashcard-back flex flex-col items-center justify-center p-6",
                    "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30",
                    "border-2 border-blue-200 dark:border-blue-800",
                    "shadow-lg"
                  )}
                >
                  {/* 한국어 훈음 */}
                  {currentKanji.korean_hun_eum && (
                    <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                      {currentKanji.korean_hun_eum}
                    </p>
                  )}

                  <div className="w-full space-y-2 text-sm">
                    {/* 음독 */}
                    {currentKanji.ja_on.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-14 font-medium text-gray-500 dark:text-gray-400">
                          音読み
                        </span>
                        <span className="text-gray-800 dark:text-gray-200">
                          {currentKanji.ja_on.join(", ")}
                        </span>
                      </div>
                    )}

                    {/* 훈독 */}
                    {currentKanji.ja_kun.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-14 font-medium text-gray-500 dark:text-gray-400">
                          訓読み
                        </span>
                        <span className="text-gray-800 dark:text-gray-200">
                          {currentKanji.ja_kun.join(", ")}
                        </span>
                      </div>
                    )}

                    {/* 영문 의미 */}
                    {currentKanji.meanings_en.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-14 font-medium text-gray-500 dark:text-gray-400">
                          English
                        </span>
                        <span className="text-gray-800 dark:text-gray-200">
                          {currentKanji.meanings_en.slice(0, 5).join(", ")}
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">
                    클릭하여 뒤집기
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 sm:h-72 text-gray-500 dark:text-gray-400">
            이 등급에 한자가 없습니다
          </div>
        )}

        {/* 컨트롤 버튼 */}
        <div className="flex items-center justify-center gap-3 px-6 pb-6">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0 || deck.length === 0}
            className={clsx(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all",
              currentIndex === 0 || deck.length === 0
                ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
            )}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            이전
          </button>

          <button
            onClick={handleFlip}
            disabled={deck.length === 0}
            className={clsx(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all",
              deck.length === 0
                ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/30"
            )}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            뒤집기
          </button>

          <button
            onClick={handleNext}
            disabled={currentIndex === deck.length - 1 || deck.length === 0}
            className={clsx(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all",
              currentIndex === deck.length - 1 || deck.length === 0
                ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
            )}
          >
            다음
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* 단축키 안내 */}
        <div className="px-6 pb-4 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            단축키: <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">Space</kbd> 뒤집기 ·
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded mx-1">←→</kbd> 이전/다음 ·
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">R</kbd> 섞기 ·
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">ESC</kbd> 닫기
          </p>
        </div>
      </div>
    </div>
  );
}
