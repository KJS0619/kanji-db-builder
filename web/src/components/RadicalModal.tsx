"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
import clsx from "clsx";
import {
  GenericFlashcardPrintModal,
  PrintableCard,
} from "@/components/GenericFlashcardPrintModal";

interface Radical {
  radical: string;
  korean_name: string;
  japanese_name: string;
  representative: string;
}

interface StrokeGroup {
  stroke_count: number;
  radicals: Radical[];
}

interface RadicalData {
  version: string;
  total_count: number;
  description: string;
  radicals: StrokeGroup[];
}

interface RadicalModalProps {
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

// 획수별 색상
const STROKE_COLORS: Record<number, string> = {
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
  13: "bg-violet-500",
  14: "bg-purple-500",
  15: "bg-fuchsia-500",
  16: "bg-pink-500",
  17: "bg-rose-500",
};

// 한·일 부수 차이 매핑 (한국 정자 → 일본 신자체)
// 강희자전 부수 중 일본에서 간략화된 것들
const KR_JP_RADICAL_DIFF: Record<string, string> = {
  "戶": "戸",   // 지게 호 (63번)
  "靑": "青",   // 푸를 청 (174번)
  "飛": "飞",   // 날 비 (183번) - 일부 약자
  "食": "食",   // 먹을 식 - 동일하지만 부수로 쓸 때 飠
  "齊": "斉",   // 가지런할 제 (210번)
  "齒": "歯",   // 이 치 (211번)
  "龍": "竜",   // 용 룡 (212번)
  "龜": "亀",   // 거북 귀 (213번)
  "黃": "黄",   // 누를 황 (201번)
  "黑": "黒",   // 검을 흑 (203번)
  "麥": "麦",   // 보리 맥 (199번)
  "鹵": "卤",   // 소금 로 (197번) - 간체자 영향
  "鳥": "鳥",   // 새 조 - 동일 (그러나 간체 鸟)
  "魚": "魚",   // 물고기 어 - 동일 (그러나 간체 鱼)
  "門": "門",   // 문 문 - 동일 (그러나 문맥에 따라 门)
  "韋": "韦",   // 가죽 위 (178번) - 간체자 영향
  "頁": "頁",   // 머리 혈 - 일본에서도 동일 (页는 간체)
  "風": "風",   // 바람 풍 - 동일 (风는 간체)
  "馬": "馬",   // 말 마 - 동일 (马는 간체)
  "鬥": "闘",   // 싸울 투 (191번) - 일본 신자체
  "鬲": "鬲",   // 솥 력 - 동일
  "髟": "髟",   // 터럭 표 - 동일
  "鬼": "鬼",   // 귀신 귀 - 동일
  "骨": "骨",   // 뼈 골 - 동일
  "高": "高",   // 높을 고 - 동일
  "鼎": "鼎",   // 솥 정 - 동일
  "鼓": "鼓",   // 북 고 - 동일
  "鼠": "鼠",   // 쥐 서 - 동일
  "鼻": "鼻",   // 코 비 - 동일
  "龠": "龠",   // 피리 약 - 동일
};

// 실제 차이가 있는 부수만 필터 (한국 ≠ 일본)
const getJpRadical = (krRadical: string): string | null => {
  const jpRadical = KR_JP_RADICAL_DIFF[krRadical];
  if (jpRadical && jpRadical !== krRadical) {
    return jpRadical;
  }
  return null;
};

export function RadicalModal({ onClose }: RadicalModalProps) {
  const [data, setData] = useState<RadicalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStroke, setSelectedStroke] = useState<number>(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [deck, setDeck] = useState<Radical[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // 데이터 로드
  useEffect(() => {
    fetch("/data/radical_214.json")
      .then((res) => res.json())
      .then((jsonData: RadicalData) => {
        setData(jsonData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load radical_214.json:", err);
        setLoading(false);
      });
  }, []);

  // 현재 획수 그룹
  const currentStrokeGroup = useMemo(() => {
    return data?.radicals.find((g) => g.stroke_count === selectedStroke);
  }, [data, selectedStroke]);

  // 전체 부수 목록 (전체 모드용)
  const allRadicals = useMemo(() => {
    if (!data) return [];
    return data.radicals.flatMap((g) => g.radicals);
  }, [data]);

  // 덱 초기화
  useEffect(() => {
    if (showAll) {
      if (allRadicals.length > 0) {
        setDeck(shuffleArray(allRadicals));
        setCurrentIndex(0);
        setIsFlipped(false);
      }
    } else if (currentStrokeGroup) {
      setDeck(shuffleArray(currentStrokeGroup.radicals));
      setCurrentIndex(0);
      setIsFlipped(false);
    } else {
      setDeck([]);
    }
  }, [currentStrokeGroup, allRadicals, showAll]);

  // 인쇄용 카드 데이터 변환
  const printableCards: PrintableCard[] = useMemo(() => {
    return deck.map((r, idx) => {
      const jpRadical = getJpRadical(r.radical);
      return {
        id: `radical-${idx}`,
        frontContent: {
          main: r.radical,
          mainKr: r.radical,  // 한국 정자 폰트
          mainJp: jpRadical || undefined,  // 차이 있는 경우만
          sub: showAll ? "부수 214" : `${selectedStroke}획`,
        },
        backContent: {
          primary: r.korean_name,
          primaryLang: "ko" as const,
          secondary: `日本語: ${r.japanese_name}`,
          secondaryLang: "ja" as const,
          tertiary: `대표 한자: ${r.representative}`,
        },
      };
    });
  }, [deck, showAll, selectedStroke]);

  // 덱 셔플
  const handleShuffle = useCallback(() => {
    if (showAll) {
      setDeck(shuffleArray(allRadicals));
    } else if (currentStrokeGroup) {
      setDeck(shuffleArray(currentStrokeGroup.radicals));
    }
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [currentStrokeGroup, allRadicals, showAll]);

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

  const currentRadical = deck[currentIndex];

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
            <span>🀄</span>
            부수 214 플래시카드
          </h2>
          <div className="flex items-center gap-2">
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

        {/* 전체/획수별 토글 */}
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowAll(true)}
            className={clsx(
              "px-4 py-1.5 text-sm font-medium rounded-lg transition-all",
              showAll
                ? "bg-purple-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
            )}
          >
            전체 (214)
          </button>
          <button
            onClick={() => setShowAll(false)}
            className={clsx(
              "px-4 py-1.5 text-sm font-medium rounded-lg transition-all",
              !showAll
                ? "bg-purple-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
            )}
          >
            획수별
          </button>
        </div>

        {/* 획수 선택 - showAll이 false일 때만 표시 */}
        {!showAll && (
          <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 scrollbar-hide">
            {data.radicals.map((group) => (
              <button
                key={group.stroke_count}
                onClick={() => setSelectedStroke(group.stroke_count)}
                className={clsx(
                  "flex-shrink-0 px-3 py-2 text-sm font-semibold transition-all relative whitespace-nowrap",
                  selectedStroke === group.stroke_count
                    ? "text-white"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                <span className="relative z-10">{group.stroke_count}획</span>
                <span
                  className={clsx(
                    "ml-1 text-xs relative z-10",
                    selectedStroke === group.stroke_count ? "text-white/80" : "text-gray-400"
                  )}
                >
                  ({group.radicals.length})
                </span>
                {selectedStroke === group.stroke_count && (
                  <div
                    className={clsx(
                      "absolute inset-0",
                      STROKE_COLORS[group.stroke_count] || "bg-gray-500"
                    )}
                  />
                )}
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
                  showAll
                    ? "bg-purple-500"
                    : STROKE_COLORS[selectedStroke] || "bg-gray-500"
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
        {deck.length > 0 && currentRadical ? (
          <div className="p-6 flex-1 overflow-auto">
            <div
              className="flashcard-container w-full h-64 sm:h-72 cursor-pointer"
              onClick={handleFlip}
            >
              <div className={clsx("flashcard w-full h-full", isFlipped && "flipped")}>
                {/* 앞면 - 부수 */}
                <div
                  className={clsx(
                    "flashcard-face flex flex-col items-center justify-center",
                    "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900",
                    "border-2 border-gray-200 dark:border-gray-700",
                    "shadow-lg rounded-xl"
                  )}
                >
                  {/* 한·일 부수 차이가 있는 경우 좌우 대비 */}
                  {getJpRadical(currentRadical.radical) ? (
                    <div className="flex items-center gap-4">
                      {/* 한국 정자 */}
                      <div className="text-center">
                        <span className="text-xs text-blue-500 dark:text-blue-400 block mb-1">한국</span>
                        <span
                          lang="ko"
                          className="kanji-kr text-7xl sm:text-8xl font-bold text-blue-600 dark:text-blue-400 select-none"
                        >
                          {currentRadical.radical}
                        </span>
                      </div>
                      {/* 화살표 */}
                      <span className="text-2xl text-gray-400">→</span>
                      {/* 일본 신자체 */}
                      <div className="text-center">
                        <span className="text-xs text-red-500 dark:text-red-400 block mb-1">일본</span>
                        <span
                          lang="ja"
                          className="kanji-jp text-7xl sm:text-8xl font-bold text-red-600 dark:text-red-400 select-none"
                        >
                          {getJpRadical(currentRadical.radical)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span
                      lang="ko"
                      className={clsx(
                        "kanji-kr text-8xl sm:text-9xl font-bold text-gray-900 dark:text-white",
                        "select-none"
                      )}
                    >
                      {currentRadical.radical}
                    </span>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <span
                      className={clsx(
                        "px-3 py-1 text-sm font-bold text-white rounded-full",
                        showAll ? "bg-purple-500" : STROKE_COLORS[selectedStroke] || "bg-gray-500"
                      )}
                    >
                      부수
                    </span>
                    {getJpRadical(currentRadical.radical) && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">
                        한·일 차이
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">클릭하여 뒤집기</p>
                </div>

                {/* 뒷면 - 정보 */}
                <div
                  className={clsx(
                    "flashcard-face flashcard-back flex flex-col items-center justify-center p-6",
                    "bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30",
                    "border-2 border-purple-200 dark:border-purple-800",
                    "shadow-lg rounded-xl"
                  )}
                >
                  {/* 한·일 부수 대비 (차이 있는 경우) */}
                  {getJpRadical(currentRadical.radical) && (
                    <div className="flex items-center gap-3 mb-3">
                      <span lang="ko" className="kanji-kr text-3xl text-blue-500">{currentRadical.radical}</span>
                      <span className="text-xl text-gray-400">→</span>
                      <span lang="ja" className="kanji-jp text-3xl text-red-500">{getJpRadical(currentRadical.radical)}</span>
                    </div>
                  )}

                  {/* 한국 명칭 */}
                  <p className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400 mb-4">
                    {currentRadical.korean_name}
                  </p>

                  <div className="w-full space-y-3 text-sm">
                    {/* 일본어 명칭 */}
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-medium text-gray-500 dark:text-gray-400">日本語</span>
                      <span lang="ja" className="text-lg text-gray-800 dark:text-gray-200">
                        {currentRadical.japanese_name}
                      </span>
                    </div>

                    {/* 대표 한자 */}
                    <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="font-medium text-gray-500 dark:text-gray-400">대표 한자</span>
                      <span lang="ko" className="kanji-kr text-lg text-gray-800 dark:text-gray-200">
                        {currentRadical.representative}
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">클릭하여 뒤집기</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 sm:h-72 text-gray-500 dark:text-gray-400">
            부수가 없습니다
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
                : "bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-600/30"
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
          title={showAll ? "부수 214 전체" : `부수 214 - ${selectedStroke}획`}
          cards={printableCards}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
