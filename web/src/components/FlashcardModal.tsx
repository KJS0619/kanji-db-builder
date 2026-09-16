"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
import { Kanji, JLPT_COLORS } from "@/types/kanji";
import { useKanjiTTS, getTTSAutoPlaySetting, setTTSAutoPlaySetting } from "@/hooks/useKanjiTTS";
import { SpeakerButton, TTSAutoPlayToggle } from "@/components/SpeakerButton";
import {
  GenericFlashcardPrintModal,
  PrintableCard,
} from "@/components/GenericFlashcardPrintModal";
import clsx from "clsx";

// 한일 한자 차이 데이터 타입
interface KanjiDiff {
  krTraditional: string;  // 한국 정자체
  jpShinjitai: string;    // 일본 신자체
  krSound: string;        // 한국어 훈음
}

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
  const [showPrintModal, setShowPrintModal] = useState(false);

  // 한일 한자 차이 데이터 (일본 신자체 → 한국 정자체 매핑)
  const [kanjiDiffMap, setKanjiDiffMap] = useState<Map<string, KanjiDiff>>(new Map());

  // TTS 훅
  const { speak, speakSequence, stop, isSpeaking, isSupported } = useKanjiTTS();

  // TTS 자동재생 설정
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);

  // 초기 자동재생 설정 로드
  useEffect(() => {
    setAutoPlayEnabled(getTTSAutoPlaySetting());
  }, []);

  // 한일 한자 차이 데이터 로드
  useEffect(() => {
    fetch("/data/kanji_diff_full.json")
      .then((res) => res.json())
      .then((data) => {
        const map = new Map<string, KanjiDiff>();
        data.kanji.forEach((k: KanjiDiff) => {
          // 일본 신자체를 키로 사용하여 한국 정자체 매핑
          map.set(k.jpShinjitai, {
            krTraditional: k.krTraditional,
            jpShinjitai: k.jpShinjitai,
            krSound: k.krSound,
          });
        });
        setKanjiDiffMap(map);
      })
      .catch(console.error);
  }, []);

  // 자동재생 설정 변경 핸들러
  const handleAutoPlayChange = useCallback((enabled: boolean) => {
    setAutoPlayEnabled(enabled);
    setTTSAutoPlaySetting(enabled);
  }, []);

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

  // 인쇄용 카드 데이터 변환
  const printableCards: PrintableCard[] = useMemo(() => {
    return deck.map((k) => ({
      id: k.literal,
      frontContent: {
        main: k.literal,
        sub: k.korean_hun_eum || "",
      },
      backContent: {
        primary: k.ja_on.join(", ") || "-",
        secondary: k.ja_kun.join(", ") || "-",
        tertiary: k.meanings_en.slice(0, 3).join(", "),
      },
    }));
  }, [deck]);

  // 초기 덱 셔플
  useEffect(() => {
    setDeck(shuffleArray(filteredByLevel));
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [filteredByLevel]);

  // 컴포넌트 언마운트 시 TTS 정리
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  // 덱 셔플
  const handleShuffle = useCallback(() => {
    stop();
    setDeck(shuffleArray(filteredByLevel));
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [filteredByLevel, stop]);

  const currentKanji = deck[currentIndex];

  // 카드 뒤집기 (자동 발음 포함)
  const handleFlip = useCallback(() => {
    const newFlipped = !isFlipped;
    setIsFlipped(newFlipped);

    // 자동재생: 뒷면으로 넘어갈 때 순차 재생
    if (newFlipped && autoPlayEnabled && isSupported && currentKanji) {
      const textsToSpeak: string[] = [];

      // 음독이 있으면 추가
      if (currentKanji.ja_on.length > 0) {
        textsToSpeak.push(currentKanji.ja_on[0]);
      }

      // 훈독이 있으면 추가
      if (currentKanji.ja_kun.length > 0) {
        // 훈독에서 송독점(.) 제거하여 발음
        const kunReading = currentKanji.ja_kun[0].replace(/\./g, "");
        textsToSpeak.push(kunReading);
      }

      if (textsToSpeak.length > 0) {
        speakSequence(textsToSpeak);
      }
    }
  }, [isFlipped, autoPlayEnabled, isSupported, currentKanji, speakSequence]);

  // 다음 카드
  const handleNext = useCallback(() => {
    if (currentIndex < deck.length - 1) {
      stop();
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    }
  }, [currentIndex, deck.length, stop]);

  // 이전 카드
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      stop();
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  }, [currentIndex, stop]);

  // 등급 변경
  const handleLevelChange = useCallback((level: JlptTab) => {
    stop();
    setSelectedLevel(level);
  }, [stop]);

  // 개별 발음 재생
  const handleSpeak = useCallback(
    (text: string) => {
      // 송독점 제거
      const cleanText = text.replace(/\./g, "");
      speak(cleanText);
    },
    [speak]
  );

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
        // S 키로 현재 카드 발음 재생
        case "s":
        case "S":
          if (currentKanji && isFlipped) {
            const textsToSpeak: string[] = [];
            if (currentKanji.ja_on.length > 0) textsToSpeak.push(currentKanji.ja_on[0]);
            if (currentKanji.ja_kun.length > 0) textsToSpeak.push(currentKanji.ja_kun[0].replace(/\./g, ""));
            if (textsToSpeak.length > 0) speakSequence(textsToSpeak);
          }
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFlip, handlePrev, handleNext, handleShuffle, onClose, currentKanji, isFlipped, speakSequence]);

  // 배경 클릭으로 닫기
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

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
          <div className="flex items-center gap-3">
            {/* TTS 자동재생 토글 */}
            <TTSAutoPlayToggle
              enabled={autoPlayEnabled}
              onChange={handleAutoPlayChange}
              isSupported={isSupported}
            />
            {/* 인쇄 버튼 */}
            <button
              onClick={() => setShowPrintModal(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="플래시카드 인쇄"
            >
              <svg
                className="w-5 h-5 text-gray-600 dark:text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
                {/* 앞면 - 한자 (한일 비교 포함) */}
                <div
                  className={clsx(
                    "flashcard-face flex flex-col items-center justify-center",
                    "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900",
                    "border-2 border-gray-200 dark:border-gray-700",
                    "shadow-lg"
                  )}
                >
                  {/* 한일 차이가 있는 경우 비교 표시 */}
                  {kanjiDiffMap.has(currentKanji.literal) ? (
                    <div className="flex flex-col items-center">
                      {/* 한일 비교 표시 */}
                      <div className="flex items-center gap-3">
                        {/* 한국 정자체 */}
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-medium text-red-500 dark:text-red-400 mb-1">韓</span>
                          <span className="text-6xl sm:text-7xl font-bold text-red-600 dark:text-red-400 select-none">
                            {kanjiDiffMap.get(currentKanji.literal)?.krTraditional}
                          </span>
                        </div>
                        {/* 화살표 */}
                        <span className="text-3xl text-gray-400 dark:text-gray-500">↔</span>
                        {/* 일본 신자체 */}
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-medium text-blue-500 dark:text-blue-400 mb-1">日</span>
                          <span className="text-6xl sm:text-7xl font-bold text-blue-600 dark:text-blue-400 select-none">
                            {currentKanji.literal}
                          </span>
                        </div>
                      </div>
                      {/* 한일 차이 라벨 */}
                      <span className="mt-2 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 rounded">
                        한일 자형 차이
                      </span>
                    </div>
                  ) : (
                    /* 차이 없는 경우 기존처럼 표시 */
                    <span
                      className={clsx(
                        "text-8xl sm:text-9xl font-bold text-gray-900 dark:text-white",
                        "select-none"
                      )}
                    >
                      {currentKanji.literal}
                    </span>
                  )}
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
                  {/* 한일 차이가 있는 경우 비교 정보 표시 */}
                  {kanjiDiffMap.has(currentKanji.literal) && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <span className="text-2xl text-red-600 dark:text-red-400 font-bold">
                        {kanjiDiffMap.get(currentKanji.literal)?.krTraditional}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="text-2xl text-blue-600 dark:text-blue-400 font-bold">
                        {currentKanji.literal}
                      </span>
                      <span className="text-xs text-amber-700 dark:text-amber-300 ml-1">
                        (정자→신자)
                      </span>
                    </div>
                  )}

                  {/* 한국어 훈음 */}
                  {currentKanji.korean_hun_eum && (
                    <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                      {currentKanji.korean_hun_eum}
                    </p>
                  )}

                  <div className="w-full space-y-2 text-sm">
                    {/* 음독 */}
                    {currentKanji.ja_on.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="flex-shrink-0 w-14 font-medium text-gray-500 dark:text-gray-400">
                          音読み
                        </span>
                        <span className="flex-1 text-gray-800 dark:text-gray-200">
                          {currentKanji.ja_on.join(", ")}
                        </span>
                        <SpeakerButton
                          text={currentKanji.ja_on[0]}
                          onSpeak={handleSpeak}
                          isSpeaking={isSpeaking}
                          size="sm"
                          title="음독 발음 듣기"
                        />
                      </div>
                    )}

                    {/* 훈독 */}
                    {currentKanji.ja_kun.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="flex-shrink-0 w-14 font-medium text-gray-500 dark:text-gray-400">
                          訓読み
                        </span>
                        <span className="flex-1 text-gray-800 dark:text-gray-200">
                          {currentKanji.ja_kun.join(", ")}
                        </span>
                        <SpeakerButton
                          text={currentKanji.ja_kun[0]}
                          onSpeak={handleSpeak}
                          isSpeaking={isSpeaking}
                          size="sm"
                          title="훈독 발음 듣기"
                        />
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
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">Space</kbd> 뒤집기 ·
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded mx-1">←→</kbd> 이전/다음 ·
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">R</kbd> 섞기 ·
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">S</kbd> 발음 ·
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">ESC</kbd> 닫기
          </p>
        </div>
      </div>

      {/* 인쇄 모달 */}
      {showPrintModal && (
        <GenericFlashcardPrintModal
          title={`JLPT ${selectedLevel} 한자`}
          cards={printableCards}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
