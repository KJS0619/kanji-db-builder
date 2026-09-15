"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
import clsx from "clsx";
import {
  GenericFlashcardPrintModal,
  PrintableCard,
} from "@/components/GenericFlashcardPrintModal";
import {
  WritingPracticePrintModal,
  WritingPracticeItem,
} from "@/components/WritingPracticePrintModal";
import { Kanji, StrokePath } from "@/types/kanji";

interface TopicKanji {
  literal: string;
  korean_hun_eum: string;
  ja_on: string;
  kr_word: string;
  jp_word: string;
}

interface Topic {
  name: string;
  kanji: TopicKanji[];
}

interface Series {
  id: number;
  name: string;
  count: number;
  description: string;
  topics: Topic[];
}

interface TopicKanjiData {
  version: string;
  total_count: number;
  description: string;
  series: Series[];
}

interface TopicKanjiModalProps {
  onClose: () => void;
}

// Fisher-Yates 셔플 알고리즘
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 탄별 색상
const SERIES_COLORS: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-orange-500",
  3: "bg-amber-500",
  4: "bg-yellow-500",
  5: "bg-lime-500",
  6: "bg-green-500",
  7: "bg-emerald-500",
  8: "bg-teal-500",
  9: "bg-cyan-500",
  10: "bg-sky-500",
  11: "bg-blue-500",
  12: "bg-indigo-500",
};

export function TopicKanjiModal({ onClose }: TopicKanjiModalProps) {
  const [data, setData] = useState<TopicKanjiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeries, setSelectedSeries] = useState<number>(1);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [deck, setDeck] = useState<TopicKanji[]>([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showWritingPracticeModal, setShowWritingPracticeModal] = useState(false);
  const [strokePathsMap, setStrokePathsMap] = useState<Map<string, StrokePath[]>>(new Map());

  // 데이터 로드
  useEffect(() => {
    // topic_kanji.json 로드
    fetch("/data/topic_kanji.json")
      .then((res) => res.json())
      .then((jsonData: TopicKanjiData) => {
        setData(jsonData);
        if (jsonData.series.length > 0 && jsonData.series[0].topics.length > 0) {
          setSelectedTopic(jsonData.series[0].topics[0].name);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load topic_kanji.json:", err);
        setLoading(false);
      });

    // kanji_master.json에서 획순 데이터 로드
    fetch("/data/kanji_master.json")
      .then((res) => res.json())
      .then((jsonData: { kanji: Kanji[] }) => {
        const map = new Map<string, StrokePath[]>();
        jsonData.kanji.forEach((k) => {
          if (k.stroke_paths && k.stroke_paths.length > 0) {
            map.set(k.literal, k.stroke_paths);
          }
        });
        setStrokePathsMap(map);
      })
      .catch((err) => {
        console.error("Failed to load kanji_master.json for stroke paths:", err);
      });
  }, []);

  // 현재 시리즈
  const currentSeries = useMemo(() => {
    return data?.series.find((s) => s.id === selectedSeries);
  }, [data, selectedSeries]);

  // 현재 토픽의 한자 목록
  const currentTopicKanji = useMemo(() => {
    if (!currentSeries) return [];
    const topic = currentSeries.topics.find((t) => t.name === selectedTopic);
    return topic?.kanji || [];
  }, [currentSeries, selectedTopic]);

  // 덱 초기화
  useEffect(() => {
    if (currentTopicKanji.length > 0) {
      setDeck(shuffleArray(currentTopicKanji));
      setCurrentIndex(0);
      setIsFlipped(false);
    } else {
      setDeck([]);
    }
  }, [currentTopicKanji]);

  // 시리즈 변경 시 첫 번째 토픽 선택
  useEffect(() => {
    if (currentSeries && currentSeries.topics.length > 0) {
      setSelectedTopic(currentSeries.topics[0].name);
    }
  }, [currentSeries]);

  // 인쇄용 카드 데이터 변환
  const printableCards: PrintableCard[] = useMemo(() => {
    return deck.map((k, idx) => ({
      id: `${selectedSeries}-${selectedTopic}-${idx}`,
      frontContent: {
        main: k.literal,
        mainKr: k.literal,  // 한국 정자 폰트로 표시
        sub: `${selectedSeries}탄 · ${selectedTopic}`,
      },
      backContent: {
        primary: k.korean_hun_eum,
        primaryLang: "ko" as const,
        secondary: `音読み: ${k.ja_on}`,
        secondaryLang: "ja" as const,
        tertiary: `${k.kr_word} | ${k.jp_word}`,
      },
    }));
  }, [deck, selectedSeries, selectedTopic]);

  // 쓰기연습용 데이터 변환
  const writingPracticeItems: WritingPracticeItem[] = useMemo(() => {
    return deck.map((k, idx) => ({
      id: `writing-${selectedSeries}-${selectedTopic}-${idx}`,
      literal: k.literal,
      hunEum: k.korean_hun_eum,
      strokePaths: strokePathsMap.get(k.literal),
    }));
  }, [deck, selectedSeries, selectedTopic, strokePathsMap]);

  // 덱 셔플
  const handleShuffle = useCallback(() => {
    setDeck(shuffleArray(currentTopicKanji));
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [currentTopicKanji]);

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

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/60"
        onClick={handleBackdropClick}
      >
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/60"
        onClick={handleBackdropClick}
      >
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-8">
          <p className="text-red-500">데이터를 불러올 수 없습니다.</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
          >
            닫기
          </button>
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
          "relative w-full max-w-lg mx-4 sm:mx-0",
          "bg-white dark:bg-gray-900 rounded-2xl",
          "shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>📚</span>
            주제별 한자 플래시카드
          </h2>
          <div className="flex items-center gap-2">
            {/* 쓰기연습 버튼 */}
            <button
              onClick={() => setShowWritingPracticeModal(true)}
              disabled={deck.length === 0}
              className={clsx(
                "p-2 rounded-lg transition-colors",
                deck.length === 0
                  ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800 text-green-600 dark:text-green-400"
              )}
              title="쓰기연습 PDF"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            {/* 인쇄 버튼 */}
            <button
              onClick={() => setShowPrintModal(true)}
              disabled={deck.length === 0}
              className={clsx(
                "p-2 rounded-lg transition-colors",
                deck.length === 0
                  ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
              )}
              title="플래시카드 인쇄"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </button>
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
        </div>

        {/* 시리즈(탄) 선택 - 스크롤 가능 */}
        <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 scrollbar-hide">
          {data.series.map((series) => (
            <button
              key={series.id}
              onClick={() => setSelectedSeries(series.id)}
              className={clsx(
                "flex-shrink-0 px-3 py-2 text-sm font-semibold transition-all relative whitespace-nowrap",
                selectedSeries === series.id
                  ? "text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <span className="relative z-10">{series.name}</span>
              <span
                className={clsx(
                  "ml-1 text-xs relative z-10",
                  selectedSeries === series.id ? "text-white/80" : "text-gray-400"
                )}
              >
                ({series.count})
              </span>
              {selectedSeries === series.id && (
                <div className={clsx("absolute inset-0", SERIES_COLORS[series.id] || "bg-gray-500")} />
              )}
            </button>
          ))}
        </div>

        {/* 토픽 선택 */}
        {currentSeries && (
          <div className="flex flex-wrap gap-1.5 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            {currentSeries.topics.map((topic) => (
              <button
                key={topic.name}
                onClick={() => setSelectedTopic(topic.name)}
                className={clsx(
                  "px-2.5 py-1 text-xs font-medium rounded-full transition-all",
                  selectedTopic === topic.name
                    ? `${SERIES_COLORS[selectedSeries] || "bg-gray-500"} text-white`
                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                )}
              >
                {topic.name} ({topic.kanji.length})
              </button>
            ))}
          </div>
        )}

        {/* 진행률 & 셔플 */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {deck.length > 0 ? currentIndex + 1 : 0} / {deck.length}
            </span>
            {/* 프로그레스 바 */}
            <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={clsx(
                  "h-full transition-all",
                  SERIES_COLORS[selectedSeries] || "bg-gray-500"
                )}
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
          <div className="p-6 flex-1 overflow-auto">
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
                    "shadow-lg rounded-xl"
                  )}
                >
                  <span
                    lang="ko"
                    className={clsx(
                      "kanji-kr text-8xl sm:text-9xl font-bold text-gray-900 dark:text-white",
                      "select-none"
                    )}
                  >
                    {currentKanji.literal}
                  </span>
                  <div className="mt-4 flex items-center gap-2">
                    <span
                      className={clsx(
                        "px-2 py-0.5 text-xs font-bold text-white rounded",
                        SERIES_COLORS[selectedSeries] || "bg-gray-500"
                      )}
                    >
                      {selectedSeries}탄
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{selectedTopic}</span>
                  </div>
                  <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">클릭하여 뒤집기</p>
                </div>

                {/* 뒷면 - 정보 */}
                <div
                  className={clsx(
                    "flashcard-face flashcard-back flex flex-col items-center justify-center p-6",
                    "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30",
                    "border-2 border-blue-200 dark:border-blue-800",
                    "shadow-lg rounded-xl"
                  )}
                >
                  {/* 한국어 훈음 */}
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                    {currentKanji.korean_hun_eum}
                  </p>

                  <div className="w-full space-y-3 text-sm">
                    {/* 음독 */}
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-medium text-gray-500 dark:text-gray-400">音読み</span>
                      <span lang="ja" className="text-lg text-gray-800 dark:text-gray-200">
                        {currentKanji.ja_on}
                      </span>
                    </div>

                    {/* 한국어 단어 vs 일본어 단어 (좌우 대비) */}
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-center gap-4">
                        {/* 한국어 단어 - 한글 폰트 */}
                        <div className="text-center">
                          <span className="text-xs text-blue-500 dark:text-blue-400 block mb-1">한국어</span>
                          <span lang="ko" className="kanji-kr text-lg text-blue-700 dark:text-blue-300 font-medium">
                            {currentKanji.kr_word}
                          </span>
                        </div>

                        {/* 구분선 */}
                        <span className="text-gray-300 dark:text-gray-600">|</span>

                        {/* 일본어 단어 - 일본 폰트 */}
                        <div className="text-center">
                          <span className="text-xs text-red-500 dark:text-red-400 block mb-1">日本語</span>
                          <span lang="ja" className="kanji-jp text-lg text-red-700 dark:text-red-300 font-medium">
                            {currentKanji.jp_word}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">클릭하여 뒤집기</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 sm:h-72 text-gray-500 dark:text-gray-400">
            이 주제에 한자가 없습니다
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
            단축키: <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">Space</kbd>{" "}
            뒤집기 ·
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded mx-1">←→</kbd>{" "}
            이전/다음 ·<kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">R</kbd> 섞기
            ·<kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">ESC</kbd> 닫기
          </p>
        </div>
      </div>

      {/* 인쇄 모달 */}
      {showPrintModal && (
        <GenericFlashcardPrintModal
          title={`주제별 한자 ${selectedSeries}탄 - ${selectedTopic}`}
          cards={printableCards}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* 쓰기연습 모달 */}
      {showWritingPracticeModal && (
        <WritingPracticePrintModal
          title={`주제별 한자 ${selectedSeries}탄 - ${selectedTopic}`}
          items={writingPracticeItems}
          onClose={() => setShowWritingPracticeModal(false)}
        />
      )}
    </div>
  );
}
