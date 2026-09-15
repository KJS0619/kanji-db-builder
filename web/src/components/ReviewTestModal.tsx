"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  MasteryCategory,
  loadMasteryRecord,
  getMasteredIds,
  markAsUnmastered,
  recordCorrectAnswer,
  MasteryRecord,
} from "@/services/masteryService";

interface KanjiDiff {
  id: string;
  krTraditional: string;
  jpShinjitai: string;
  krSound: string;
  jpOn: string;
  jpKun: string;
  diffCategory: string;
}

interface KanjiDiffData {
  version: string;
  description: string;
  total_count: number;
  kanji: KanjiDiff[];
}

interface ReviewTestModalProps {
  onClose: () => void;
}

type TestPhase = "intro" | "testing" | "result";

interface TestResult {
  kanjiId: string;
  kanji: KanjiDiff;
  remembered: boolean;
}

export function ReviewTestModal({ onClose }: ReviewTestModalProps) {
  const [data, setData] = useState<KanjiDiffData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [masteryRecord, setMasteryRecord] = useState<MasteryRecord>({});

  // 테스트 상태
  const [phase, setPhase] = useState<TestPhase>("intro");
  const [testCards, setTestCards] = useState<KanjiDiff[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const MASTERY_CATEGORY: MasteryCategory = "kanji_diff";

  // 데이터 로드
  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch("/data/kanji_diff_full.json");
        const json: KanjiDiffData = await response.json();
        setData(json);

        // 마스터리 레코드 로드
        const record = loadMasteryRecord(MASTERY_CATEGORY);
        setMasteryRecord(record);
      } catch (error) {
        console.error("Failed to load kanji diff data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // 마스터한 카드 목록
  const masteredKanji = useMemo(() => {
    if (!data) return [];
    const masteredIds = getMasteredIds(MASTERY_CATEGORY);
    return data.kanji.filter(k => masteredIds.includes(k.id));
  }, [data, masteryRecord]);

  // Fisher-Yates 셔플
  const shuffleArray = useCallback(<T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  // 테스트 시작
  const handleStartTest = useCallback(() => {
    if (masteredKanji.length === 0) return;

    const shuffled = shuffleArray(masteredKanji);
    setTestCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setResults([]);
    setPhase("testing");
  }, [masteredKanji, shuffleArray]);

  // 현재 카드
  const currentCard = testCards[currentIndex];

  // 카드 뒤집기
  const handleFlip = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

  // 정답 처리 (확실히 기억나요)
  const handleRemembered = useCallback(() => {
    if (!currentCard) return;

    // 정답 기록
    recordCorrectAnswer(MASTERY_CATEGORY, currentCard.id);

    // 결과 추가
    setResults(prev => [...prev, {
      kanjiId: currentCard.id,
      kanji: currentCard,
      remembered: true,
    }]);

    // 다음 카드로
    if (currentIndex < testCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      setPhase("result");
    }
  }, [currentCard, currentIndex, testCards.length]);

  // 오답 처리 (아직 헷갈려요)
  const handleForgotten = useCallback(() => {
    if (!currentCard) return;

    // 마스터리 해제
    const updated = markAsUnmastered(MASTERY_CATEGORY, currentCard.id);
    setMasteryRecord(prev => ({ ...prev, [currentCard.id]: updated }));

    // 결과 추가
    setResults(prev => [...prev, {
      kanjiId: currentCard.id,
      kanji: currentCard,
      remembered: false,
    }]);

    // 다음 카드로
    if (currentIndex < testCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      setPhase("result");
    }
  }, [currentCard, currentIndex, testCards.length]);

  // 결과 통계
  const resultStats = useMemo(() => {
    const total = results.length;
    const remembered = results.filter(r => r.remembered).length;
    const forgotten = total - remembered;
    const accuracy = total > 0 ? Math.round((remembered / total) * 100) : 0;
    return { total, remembered, forgotten, accuracy };
  }, [results]);

  // 키보드 이벤트
  useEffect(() => {
    if (phase !== "testing") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!isFlipped) {
          handleFlip();
        }
      } else if (e.key === "ArrowLeft" || e.key === "1") {
        if (isFlipped) handleForgotten();
      } else if (e.key === "ArrowRight" || e.key === "2") {
        if (isFlipped) handleRemembered();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, isFlipped, handleFlip, handleForgotten, handleRemembered, onClose]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                🧠 복습 테스트
              </h2>
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded-full">
                한·일 차이 한자
              </span>
            </div>
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

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 인트로 화면 */}
          {phase === "intro" && (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
              <div className="text-6xl mb-6">🎯</div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                학습 완료 한자 복습
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md">
                학습 완료로 표시한 한자들을 무작위로 섞어서 테스트합니다.
                <br />
                기억나지 않는 한자는 다시 학습 목록에 추가됩니다.
              </p>

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-xl p-6 mb-8">
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  {masteredKanji.length}개
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  학습 완료 한자
                </div>
              </div>

              {masteredKanji.length > 0 ? (
                <button
                  onClick={handleStartTest}
                  className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                >
                  🚀 테스트 시작하기
                </button>
              ) : (
                <div className="text-gray-500 dark:text-gray-400">
                  <p className="mb-2">학습 완료된 한자가 없습니다.</p>
                  <p className="text-sm">한·일 차이 모달에서 한자를 학습 완료로 표시해 주세요.</p>
                </div>
              )}
            </div>
          )}

          {/* 테스트 화면 */}
          {phase === "testing" && currentCard && (
            <div className="flex flex-col items-center">
              {/* 진행 상황 */}
              <div className="w-full mb-6">
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <span>{currentIndex + 1} / {testCards.length}</span>
                  <span>{Math.round(((currentIndex + 1) / testCards.length) * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / testCards.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* 플래시카드 */}
              <div
                className="flashcard-container w-full max-w-md cursor-pointer mb-6"
                style={{ height: "300px" }}
                onClick={handleFlip}
              >
                <div className={`flashcard w-full h-full ${isFlipped ? "flipped" : ""}`}>
                  {/* 앞면: 질문 */}
                  <div className="flashcard-face bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl shadow-lg p-6 flex flex-col items-center justify-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      이 한자의 일본 신자체는?
                    </div>
                    <div className="text-8xl font-bold text-gray-800 dark:text-white mb-4">
                      {currentCard.krTraditional}
                    </div>
                    <div className="text-lg text-gray-600 dark:text-gray-300">
                      {currentCard.krSound}
                    </div>
                    <div className="text-center text-sm text-gray-400 dark:text-gray-500 mt-6">
                      클릭하여 정답 확인
                    </div>
                  </div>

                  {/* 뒷면: 정답 */}
                  <div className="flashcard-face flashcard-back bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-lg p-6 flex flex-col items-center justify-center text-white">
                    <div className="flex items-center gap-8 mb-6">
                      <div className="text-center">
                        <div className="text-sm text-gray-400 mb-1">한국</div>
                        <div className="text-5xl">{currentCard.krTraditional}</div>
                      </div>
                      <div className="text-3xl text-gray-500">→</div>
                      <div className="text-center">
                        <div className="text-sm text-yellow-400 mb-1">일본</div>
                        <div className="text-5xl text-yellow-300">{currentCard.jpShinjitai}</div>
                      </div>
                    </div>

                    <div className="text-center mb-4">
                      <span className="text-gray-400">훈음: </span>
                      <span>{currentCard.krSound}</span>
                    </div>

                    <div className="flex gap-4 text-sm">
                      {currentCard.jpOn && (
                        <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded">
                          음: {currentCard.jpOn}
                        </span>
                      )}
                      {currentCard.jpKun && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                          훈: {currentCard.jpKun}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 px-3 py-1 bg-gray-700 rounded-full text-xs text-gray-400">
                      {currentCard.diffCategory}
                    </div>
                  </div>
                </div>
              </div>

              {/* 버튼 */}
              {isFlipped ? (
                <div className="flex gap-4 w-full max-w-md">
                  <button
                    onClick={handleForgotten}
                    className="flex-1 py-4 px-6 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                  >
                    <div className="text-2xl mb-1">😅</div>
                    <div>아직 헷갈려요</div>
                    <div className="text-xs opacity-75 mt-1">(다시 학습)</div>
                  </button>
                  <button
                    onClick={handleRemembered}
                    className="flex-1 py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                  >
                    <div className="text-2xl mb-1">😊</div>
                    <div>확실히 기억나요</div>
                    <div className="text-xs opacity-75 mt-1">(학습 완료 유지)</div>
                  </button>
                </div>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <p>카드를 클릭하여 정답을 확인하세요</p>
                  <p className="text-xs mt-2">Space/Enter: 뒤집기 | ←/1: 헷갈려요 | →/2: 기억나요</p>
                </div>
              )}
            </div>
          )}

          {/* 결과 화면 */}
          {phase === "result" && (
            <div className="flex flex-col items-center text-center">
              <div className="text-6xl mb-6">
                {resultStats.accuracy >= 80 ? "🎉" : resultStats.accuracy >= 50 ? "👍" : "💪"}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                테스트 완료!
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-8">
                {resultStats.accuracy >= 80
                  ? "훌륭해요! 대부분 기억하고 있네요!"
                  : resultStats.accuracy >= 50
                  ? "좋아요! 조금 더 복습하면 완벽해질 거예요!"
                  : "괜찮아요! 복습을 통해 더 잘 기억할 수 있어요!"}
              </p>

              {/* 통계 */}
              <div className="grid grid-cols-3 gap-4 mb-8 w-full max-w-md">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
                  <div className="text-3xl font-bold text-gray-800 dark:text-white">
                    {resultStats.total}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">전체</div>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 rounded-xl p-4">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {resultStats.remembered}
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-400">기억함</div>
                </div>
                <div className="bg-orange-100 dark:bg-orange-900/30 rounded-xl p-4">
                  <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                    {resultStats.forgotten}
                  </div>
                  <div className="text-sm text-orange-600 dark:text-orange-400">다시 학습</div>
                </div>
              </div>

              {/* 정확도 바 */}
              <div className="w-full max-w-md mb-8">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">정확도</span>
                  <span className="font-bold text-gray-900 dark:text-white">{resultStats.accuracy}%</span>
                </div>
                <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      resultStats.accuracy >= 80
                        ? "bg-gradient-to-r from-green-500 to-emerald-500"
                        : resultStats.accuracy >= 50
                        ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                        : "bg-gradient-to-r from-orange-500 to-red-500"
                    }`}
                    style={{ width: `${resultStats.accuracy}%` }}
                  />
                </div>
              </div>

              {/* 헷갈린 한자 목록 */}
              {resultStats.forgotten > 0 && (
                <div className="w-full max-w-md mb-8">
                  <h4 className="text-left font-bold text-gray-700 dark:text-gray-300 mb-3">
                    🔄 다시 학습할 한자 ({resultStats.forgotten}개)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {results
                      .filter(r => !r.remembered)
                      .map(r => (
                        <div
                          key={r.kanjiId}
                          className="px-3 py-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg"
                        >
                          <span className="text-xl mr-2">{r.kanji.krTraditional}</span>
                          <span className="text-gray-500">→</span>
                          <span className="text-xl ml-2 text-orange-600 dark:text-orange-400">
                            {r.kanji.jpShinjitai}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 버튼 */}
              <div className="flex gap-4">
                <button
                  onClick={() => setPhase("intro")}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-medium rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  다시 테스트
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all"
                >
                  완료
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
