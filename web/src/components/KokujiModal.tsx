"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useKanjiTTS, getTTSAutoPlaySetting, setTTSAutoPlaySetting } from "@/hooks/useKanjiTTS";
import { SpeakerButton, TTSAutoPlayToggle } from "@/components/SpeakerButton";
import {
  GenericFlashcardPrintModal,
  PrintableCard,
} from "@/components/GenericFlashcardPrintModal";

interface Example {
  word: string;
  reading: string;
  meaning: string;
}

interface Kokuji {
  id: string;
  literal: string;
  korean_reading: string;
  jpOn: string;
  jpKun: string;
  meanings: string[];
  stroke_count: number;
  radical: string;
  examples: Example[];
  etymology: string;
}

interface KokujiData {
  version: string;
  description: string;
  total_count: number;
  kanji: Kokuji[];
}

interface KokujiModalProps {
  onClose: () => void;
}

export function KokujiModal({ onClose }: KokujiModalProps) {
  const [data, setData] = useState<KokujiData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [shuffledKanji, setShuffledKanji] = useState<Kokuji[]>([]);
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [showPrintModal, setShowPrintModal] = useState(false);

  // TTS 훅
  const { speak, speakSequence, stop, isSpeaking, isSupported } = useKanjiTTS();

  // TTS 자동재생 설정
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);

  // 초기 자동재생 설정 로드
  useEffect(() => {
    setAutoPlayEnabled(getTTSAutoPlaySetting());
  }, []);

  // 자동재생 설정 변경 핸들러
  const handleAutoPlayChange = useCallback((enabled: boolean) => {
    setAutoPlayEnabled(enabled);
    setTTSAutoPlaySetting(enabled);
  }, []);

  // 데이터 로드
  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch("/data/kokuji.json");
        const json: KokujiData = await response.json();
        setData(json);
        setShuffledKanji(json.kanji);
      } catch (error) {
        console.error("Failed to load kokuji data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // 현재 표시할 한자 목록
  const displayKanji = isShuffled ? shuffledKanji : (data?.kanji || []);
  const currentKanji = displayKanji[currentIndex];

  // 인쇄용 카드 데이터 변환
  const printableCards: PrintableCard[] = useMemo(() => {
    return displayKanji.map((k) => ({
      id: k.id,
      frontContent: {
        main: k.literal,
        sub: k.korean_reading,
      },
      backContent: {
        primary: k.jpKun || "-",
        secondary: k.meanings.join(", "),
        tertiary: k.examples[0] ? `${k.examples[0].word} (${k.examples[0].reading})` : undefined,
        extra: k.etymology,
      },
    }));
  }, [displayKanji]);

  // 컴포넌트 언마운트 시 TTS 정리
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  // 개별 발음 재생
  const handleSpeak = useCallback(
    (text: string) => {
      const cleanText = text.replace(/\./g, "").replace(/,/g, " ");
      speak(cleanText);
    },
    [speak]
  );

  // Fisher-Yates 셔플
  const shuffleArray = useCallback((array: Kokuji[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  // 셔플 토글
  const handleShuffle = useCallback(() => {
    if (data) {
      stop();
      if (!isShuffled) {
        setShuffledKanji(shuffleArray(data.kanji));
      } else {
        setShuffledKanji(data.kanji);
      }
      setIsShuffled(!isShuffled);
      setCurrentIndex(0);
      setIsFlipped(false);
    }
  }, [data, isShuffled, shuffleArray, stop]);

  // 이전 카드
  const handlePrev = useCallback(() => {
    stop();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : displayKanji.length - 1));
    setIsFlipped(false);
  }, [displayKanji.length, stop]);

  // 다음 카드
  const handleNext = useCallback(() => {
    stop();
    setCurrentIndex((prev) => (prev < displayKanji.length - 1 ? prev + 1 : 0));
    setIsFlipped(false);
  }, [displayKanji.length, stop]);

  // 카드 뒤집기 (자동 발음 포함)
  const handleFlip = useCallback(() => {
    const newFlipped = !isFlipped;
    setIsFlipped(newFlipped);

    // 자동재생: 뒷면으로 넘어갈 때 순차 재생
    if (newFlipped && autoPlayEnabled && isSupported && currentKanji) {
      const textsToSpeak: string[] = [];

      // 훈독이 있으면 추가 (국자는 주로 훈독)
      if (currentKanji.jpKun) {
        const kunReading = currentKanji.jpKun.split(",")[0].replace(/\./g, "").trim();
        textsToSpeak.push(kunReading);
      }

      // 음독이 있으면 추가
      if (currentKanji.jpOn) {
        textsToSpeak.push(currentKanji.jpOn.split(",")[0].trim());
      }

      // 대표 예문 단어 추가
      if (currentKanji.examples.length > 0) {
        textsToSpeak.push(currentKanji.examples[0].word);
      }

      if (textsToSpeak.length > 0) {
        speakSequence(textsToSpeak);
      }
    }
  }, [isFlipped, autoPlayEnabled, isSupported, currentKanji, speakSequence]);

  // 키보드 이벤트
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "ArrowRight") handleNext();
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleFlip();
      }
      else if (e.key === "s" || e.key === "S") {
        // S키로 발음 재생
        if (currentKanji && isFlipped) {
          const textsToSpeak: string[] = [];
          if (currentKanji.jpKun) textsToSpeak.push(currentKanji.jpKun.split(",")[0].replace(/\./g, "").trim());
          if (currentKanji.jpOn) textsToSpeak.push(currentKanji.jpOn.split(",")[0].trim());
          if (currentKanji.examples.length > 0) textsToSpeak.push(currentKanji.examples[0].word);
          if (textsToSpeak.length > 0) speakSequence(textsToSpeak);
        }
      }
      else if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext, handleFlip, onClose, currentKanji, isFlipped, speakSequence]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!data || displayKanji.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
          <p className="text-gray-600 dark:text-gray-300">데이터를 불러올 수 없습니다.</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-500 text-white rounded-lg"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                🇯🇵 일본 국자(国字)
              </h2>
              <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs rounded-full">
                일본 고유 한자
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {displayKanji.length}자
              </span>
            </div>
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
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="플래시카드 인쇄"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* 컨트롤 바 */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* 뷰 모드 토글 */}
            <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
              <button
                onClick={() => setViewMode("card")}
                className={`px-3 py-1.5 text-sm ${viewMode === "card" ? "bg-red-500 text-white" : "bg-gray-100 dark:bg-gray-700"}`}
              >
                카드
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 text-sm ${viewMode === "list" ? "bg-red-500 text-white" : "bg-gray-100 dark:bg-gray-700"}`}
              >
                목록
              </button>
            </div>

            {/* 셔플 버튼 */}
            <button
              onClick={handleShuffle}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                isShuffled
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              🔀 {isShuffled ? "정렬" : "셔플"}
            </button>

            {/* 설명 */}
            <div className="ml-auto text-xs text-gray-500 dark:text-gray-400">
              💡 일본에서 독자적으로 만든 한자
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-4">
          {viewMode === "card" ? (
            /* 카드 뷰 */
            <div className="flex flex-col items-center">
              {/* 플래시카드 */}
              <div
                className="flashcard-container w-full max-w-lg cursor-pointer"
                style={{ height: "380px" }}
                onClick={handleFlip}
              >
                <div className={`flashcard w-full h-full ${isFlipped ? "flipped" : ""}`}>
                  {/* 앞면: 한자 */}
                  <div className="flashcard-face bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/30 rounded-2xl shadow-lg p-6 flex flex-col items-center justify-center relative">
                    {/* 국자 라벨 */}
                    <div className="absolute top-4 left-4">
                      <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full font-medium">
                        🇯🇵 国字
                      </span>
                    </div>

                    {/* 한자 */}
                    <div className="text-9xl font-bold text-gray-800 dark:text-white mb-4">
                      {currentKanji.literal}
                    </div>

                    {/* 부수 & 획수 */}
                    <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>부수: {currentKanji.radical}</span>
                      <span>{currentKanji.stroke_count}획</span>
                    </div>

                    <div className="text-center text-sm text-gray-400 dark:text-gray-500 mt-4">
                      클릭하여 뒤집기
                    </div>
                  </div>

                  {/* 뒷면: 상세 정보 */}
                  <div className="flashcard-face flashcard-back bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-lg p-6 flex flex-col text-white overflow-y-auto">
                    {/* 한자 (작게) */}
                    <div className="text-center mb-3">
                      <span className="text-4xl">{currentKanji.literal}</span>
                      <span className="ml-3 text-xl text-yellow-300">{currentKanji.korean_reading}</span>
                    </div>

                    {/* 일본어 읽기 */}
                    <div className="text-center mb-4 space-y-1">
                      {currentKanji.jpOn && (
                        <div className="text-sm flex items-center justify-center gap-2">
                          <span className="text-gray-400">음독: </span>
                          <span className="text-red-300">{currentKanji.jpOn}</span>
                          <SpeakerButton
                            text={currentKanji.jpOn.split(",")[0].trim()}
                            onSpeak={handleSpeak}
                            isSpeaking={isSpeaking}
                            size="sm"
                            title="음독 발음 듣기"
                            className="text-gray-300 hover:text-white"
                          />
                        </div>
                      )}
                      {currentKanji.jpKun && (
                        <div className="text-sm flex items-center justify-center gap-2">
                          <span className="text-gray-400">훈독: </span>
                          <span className="text-blue-300">{currentKanji.jpKun}</span>
                          <SpeakerButton
                            text={currentKanji.jpKun.split(",")[0]}
                            onSpeak={handleSpeak}
                            isSpeaking={isSpeaking}
                            size="sm"
                            title="훈독 발음 듣기"
                            className="text-gray-300 hover:text-white"
                          />
                        </div>
                      )}
                    </div>

                    {/* 뜻 */}
                    <div className="text-center mb-4">
                      <span className="text-gray-400 text-sm">뜻: </span>
                      <span>{currentKanji.meanings.join(", ")}</span>
                    </div>

                    {/* 어원 */}
                    <div className="bg-gray-700/50 rounded-lg p-3 mb-4">
                      <div className="text-xs text-gray-400 mb-1">📖 어원</div>
                      <div className="text-sm">{currentKanji.etymology}</div>
                    </div>

                    {/* 예문 */}
                    <div className="flex-1">
                      <div className="text-xs text-gray-400 mb-2">📝 예문</div>
                      <div className="space-y-2">
                        {currentKanji.examples.slice(0, 3).map((ex, i) => (
                          <div key={i} className="bg-gray-700/30 rounded px-3 py-2 text-sm flex items-center gap-2">
                            <span className="text-orange-300">{ex.word}</span>
                            <SpeakerButton
                              text={ex.word}
                              onSpeak={handleSpeak}
                              isSpeaking={isSpeaking}
                              size="sm"
                              title={`${ex.word} 발음 듣기`}
                              className="text-gray-300 hover:text-white"
                            />
                            <span className="text-gray-400">({ex.reading})</span>
                            <span className="text-gray-300">{ex.meaning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 네비게이션 */}
              <div className="flex items-center gap-4 mt-6">
                <button
                  onClick={handlePrev}
                  className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className="text-lg font-medium text-gray-700 dark:text-gray-300">
                  {currentIndex + 1} / {displayKanji.length}
                </div>

                <button
                  onClick={handleNext}
                  className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* 키보드 단축키 안내 */}
              <div className="mt-4 text-xs text-gray-400 dark:text-gray-500 text-center">
                ← → 이동 | Space/Enter 뒤집기 | S 발음 | ESC 닫기
              </div>
            </div>
          ) : (
            /* 목록 뷰 */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayKanji.map((kanji, index) => (
                <div
                  key={kanji.id}
                  onClick={() => {
                    setCurrentIndex(index);
                    setViewMode("card");
                  }}
                  className="p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-gray-700 dark:to-gray-600 rounded-xl cursor-pointer hover:shadow-lg transition-all"
                >
                  <div className="flex items-start gap-4">
                    {/* 한자 */}
                    <div className="text-4xl font-bold text-gray-800 dark:text-white">
                      {kanji.literal}
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white mb-1">
                        {kanji.korean_reading}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        {kanji.meanings.join(", ")}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {kanji.jpKun && <span>훈독: {kanji.jpKun}</span>}
                      </div>
                    </div>

                    {/* 라벨 */}
                    <div className="flex-shrink-0">
                      <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full">
                        国字
                      </span>
                    </div>
                  </div>

                  {/* 대표 예문 */}
                  {kanji.examples[0] && (
                    <div className="mt-3 pt-3 border-t border-red-200 dark:border-gray-500 text-sm">
                      <span className="text-orange-600 dark:text-orange-400">{kanji.examples[0].word}</span>
                      <span className="text-gray-500 mx-1">→</span>
                      <span className="text-gray-600 dark:text-gray-300">{kanji.examples[0].meaning}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 인쇄 모달 */}
      {showPrintModal && (
        <GenericFlashcardPrintModal
          title="일본 국자"
          cards={printableCards}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
