"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
import { JLPT_COLORS } from "@/types/kanji";
import clsx from "clsx";

interface JlptWord {
  word: string;
  reading: string;
  meaning: string;
  jlpt: string;
}

interface WordFlashcardModalProps {
  onClose: () => void;
}

type JlptTab = "N5" | "N4" | "N3" | "N2" | "N1";

const JLPT_TABS: JlptTab[] = ["N5", "N4", "N3", "N2", "N1"];

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function WordFlashcardModal({ onClose }: WordFlashcardModalProps) {
  const [words, setWords] = useState<JlptWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<JlptTab>("N3");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [deck, setDeck] = useState<JlptWord[]>([]);

  // Load word data
  useEffect(() => {
    async function loadWords() {
      try {
        const response = await fetch("/data/jlpt_words.json");
        const data = await response.json();
        setWords(data.words);
      } catch (error) {
        console.error("Failed to load JLPT words:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadWords();
  }, []);

  // Filter by level
  const filteredByLevel = useMemo(() => {
    return words.filter((w) => w.jlpt === selectedLevel);
  }, [words, selectedLevel]);

  // Count by level
  const levelCounts = useMemo(() => {
    const counts: Record<JlptTab, number> = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 };
    words.forEach((w) => {
      if (counts[w.jlpt as JlptTab] !== undefined) {
        counts[w.jlpt as JlptTab]++;
      }
    });
    return counts;
  }, [words]);

  // Shuffle deck when level changes
  useEffect(() => {
    setDeck(shuffleArray(filteredByLevel));
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [filteredByLevel]);

  const handleShuffle = useCallback(() => {
    setDeck(shuffleArray(filteredByLevel));
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [filteredByLevel]);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < deck.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    }
  }, [currentIndex, deck.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  const handleLevelChange = useCallback((level: JlptTab) => {
    setSelectedLevel(level);
  }, []);

  // Keyboard shortcuts
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

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const currentWord = deck[currentIndex];

  if (isLoading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/60"
        onClick={handleBackdropClick}
      >
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">단어 로딩 중...</p>
        </div>
      </div>
    );
  }

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
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>📖</span>
            단어 암기장
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

        {/* JLPT level tabs */}
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

        {/* Progress & Shuffle */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {deck.length > 0 ? currentIndex + 1 : 0} / {deck.length}
            </span>
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

        {/* Flashcard */}
        {deck.length > 0 && currentWord ? (
          <div className="p-6">
            <div
              className="flashcard-container w-full h-64 sm:h-72 cursor-pointer"
              onClick={handleFlip}
            >
              <div className={clsx("flashcard w-full h-full", isFlipped && "flipped")}>
                {/* Front - Japanese word */}
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
                      "text-5xl sm:text-6xl font-bold text-gray-900 dark:text-white",
                      "select-none"
                    )}
                  >
                    {currentWord.word}
                  </span>
                  <div className="mt-4 flex items-center gap-2">
                    <span
                      className={clsx(
                        "px-2 py-0.5 text-xs font-bold text-white rounded",
                        JLPT_COLORS[currentWord.jlpt]
                      )}
                    >
                      {currentWord.jlpt}
                    </span>
                  </div>
                  <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">
                    클릭하여 뒤집기
                  </p>
                </div>

                {/* Back - Reading & Meaning */}
                <div
                  className={clsx(
                    "flashcard-face flashcard-back flex flex-col items-center justify-center p-6",
                    "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30",
                    "border-2 border-emerald-200 dark:border-emerald-800",
                    "shadow-lg"
                  )}
                >
                  {/* Reading (Furigana) */}
                  <p className="text-3xl sm:text-4xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                    {currentWord.reading}
                  </p>

                  {/* Word again for reference */}
                  <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
                    {currentWord.word}
                  </p>

                  {/* Korean meaning */}
                  <div className="w-full text-center">
                    <div className="inline-block px-4 py-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                      <span className="text-lg font-medium text-gray-800 dark:text-gray-200">
                        {currentWord.meaning}
                      </span>
                    </div>
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
            이 등급에 단어가 없습니다
          </div>
        )}

        {/* Control buttons */}
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
                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/30"
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

        {/* Keyboard shortcuts */}
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
