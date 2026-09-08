"use client";

import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { Kanji, JLPT_COLORS } from "@/types/kanji";
import { CustomWord, WordFormData, POS_OPTIONS, WordPOS } from "@/types/word";
import { fetchWords, addWord, deleteWord } from "@/services/vocabService";
import { extractKanji, createKanjiMap, getKanjiDetails } from "@/utils/kanjiParser";
import { KanjiModal } from "./KanjiModal";
import clsx from "clsx";
import * as wanakana from "wanakana";

interface MyVocabModalProps {
  kanjiList: Kanji[];
  onClose: () => void;
}

type ViewMode = "list" | "flashcard" | "add";

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function MyVocabModal({ kanjiList, onClose }: MyVocabModalProps) {
  const [words, setWords] = useState<CustomWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedKanji, setSelectedKanji] = useState<Kanji | null>(null);

  // Form state
  const [formData, setFormData] = useState<WordFormData>({
    word: "",
    reading: "",
    meaning: "",
    pos: "명사",
    memo: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Kanji suggestion state
  const [kanjiSuggestions, setKanjiSuggestions] = useState<Kanji[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [wordInputQuery, setWordInputQuery] = useState("");
  const wordInputRef = useRef<HTMLInputElement>(null);
  const readingInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Flashcard state
  const [deck, setDeck] = useState<CustomWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Kanji map for O(1) lookup
  const kanjiMap = useMemo(() => createKanjiMap(kanjiList), [kanjiList]);

  // Extract kanji from current word input
  const formKanjiDetails = useMemo(
    () => getKanjiDetails(formData.word, kanjiMap),
    [formData.word, kanjiMap]
  );

  // Search kanji by reading (hiragana/katakana/romaji)
  const searchKanjiByReading = useCallback(
    (query: string): Kanji[] => {
      if (!query || query.length < 1) return [];

      // Convert romaji to hiragana if needed
      const hiraganaQuery = wanakana.isRomaji(query)
        ? wanakana.toHiragana(query)
        : query;

      // Also convert to katakana for on'yomi matching
      const katakanaQuery = wanakana.toKatakana(hiraganaQuery);

      const results: Kanji[] = [];
      const seen = new Set<string>();

      for (const kanji of kanjiList) {
        if (seen.has(kanji.literal)) continue;

        // Match ja_on (音読み - katakana)
        const matchOn = kanji.ja_on?.some((on) =>
          on.startsWith(katakanaQuery) || on.includes(katakanaQuery)
        );

        // Match ja_kun (訓読み - hiragana)
        const matchKun = kanji.ja_kun?.some((kun) => {
          const cleanKun = kun.replace(/[-.]/g, "");
          return cleanKun.startsWith(hiraganaQuery) || cleanKun.includes(hiraganaQuery);
        });

        // Match korean_hun_eum
        const matchKorean = kanji.korean_hun_eum?.includes(query);

        if (matchOn || matchKun || matchKorean) {
          results.push(kanji);
          seen.add(kanji.literal);
        }

        if (results.length >= 12) break;
      }

      return results;
    },
    [kanjiList]
  );

  // Handle word input change with kanji suggestions
  const handleWordInputChange = useCallback(
    (value: string) => {
      setFormData((prev) => ({ ...prev, word: value }));

      // Extract the last segment after any kanji for suggestion
      const lastSegment = value.match(/[a-zA-Zぁ-んァ-ン가-힣]+$/)?.[0] || "";
      setWordInputQuery(lastSegment);

      if (lastSegment.length >= 1) {
        const suggestions = searchKanjiByReading(lastSegment);
        setKanjiSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      } else {
        setKanjiSuggestions([]);
        setShowSuggestions(false);
      }
    },
    [searchKanjiByReading]
  );

  // Insert kanji into word field
  const insertKanji = useCallback(
    (kanji: Kanji) => {
      const currentWord = formData.word;
      // Replace the query portion with the kanji
      const newWord = currentWord.replace(
        new RegExp(`${wordInputQuery}$`),
        kanji.literal
      );
      setFormData((prev) => ({ ...prev, word: newWord }));
      setShowSuggestions(false);
      setWordInputQuery("");
      wordInputRef.current?.focus();
    },
    [formData.word, wordInputQuery]
  );

  // Handle reading input with automatic hiragana conversion (IMEMode for partial input)
  // Only allow romaji (a-z) input, which gets converted to hiragana
  const handleReadingInputChange = useCallback((value: string) => {
    // Filter to only allow romaji letters (a-z, A-Z) - remove any other characters
    const romajiOnly = value.replace(/[^a-zA-Z]/g, "");
    // Convert romaji to hiragana with IMEMode (keeps incomplete romaji like 'n' as-is)
    const converted = wanakana.toHiragana(romajiOnly, { IMEMode: true });
    setFormData((prev) => ({ ...prev, reading: converted }));
  }, []);

  // Finalize hiragana conversion on blur (convert any remaining romaji)
  const handleReadingBlur = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      reading: wanakana.toHiragana(prev.reading, { IMEMode: false }),
    }));
  }, []);

  // Handle meaning input - only allow Korean characters and spaces
  const handleMeaningInputChange = useCallback((value: string) => {
    // Filter to only allow Korean (Hangul) characters, spaces, and basic punctuation
    // Hangul syllables: 가-힣, Hangul jamo: ㄱ-ㅎ, ㅏ-ㅣ
    const koreanOnly = value.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ\s,.~\-()]/g, "");
    setFormData((prev) => ({ ...prev, meaning: koreanOnly }));
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideInput = wordInputRef.current?.contains(target);
      const isInsideSuggestions = suggestionsRef.current?.contains(target);

      if (!isInsideInput && !isInsideSuggestions) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load words on mount
  useEffect(() => {
    loadWords();
  }, []);

  const loadWords = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchWords();
      setWords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.word || !formData.reading || !formData.meaning) return;

    try {
      setIsSubmitting(true);
      const newWord = await addWord(formData);
      setWords((prev) => [newWord, ...prev]);
      setFormData({ word: "", reading: "", meaning: "", pos: "명사", memo: "" });
      setViewMode("list");
    } catch (err) {
      setError(err instanceof Error ? err.message : "단어 추가에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm("이 단어를 삭제하시겠습니까?")) return;

    try {
      await deleteWord(id);
      setWords((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "단어 삭제에 실패했습니다.");
    }
  };

  // Start flashcard mode
  const startFlashcard = useCallback(() => {
    if (words.length === 0) return;
    setDeck(shuffleArray(words));
    setCurrentIndex(0);
    setIsFlipped(false);
    setViewMode("flashcard");
  }, [words]);

  // Flashcard controls
  const handleFlip = useCallback(() => setIsFlipped((prev) => !prev), []);
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
  const handleShuffle = useCallback(() => {
    setDeck(shuffleArray(words));
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [words]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode === "flashcard") {
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
        }
      }
      if (e.key === "Escape") {
        if (selectedKanji) {
          setSelectedKanji(null);
        } else if (viewMode !== "list") {
          setViewMode("list");
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, selectedKanji, handleFlip, handlePrev, handleNext, handleShuffle, onClose]);


  const currentWord = deck[currentIndex];

  // Render kanji chips
  const renderKanjiChips = (text: string, size: "sm" | "md" = "sm") => {
    const kanjiDetails = getKanjiDetails(text, kanjiMap);
    if (kanjiDetails.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1">
        {kanjiDetails.map((kanji) => (
          <button
            key={kanji.literal}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedKanji(kanji);
            }}
            className={clsx(
              "inline-flex items-center gap-1 rounded transition-colors",
              size === "sm"
                ? "px-1.5 py-0.5 text-xs"
                : "px-2 py-1 text-sm",
              "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
              "hover:bg-amber-200 dark:hover:bg-amber-800/50",
              "border border-amber-300 dark:border-amber-700"
            )}
          >
            <span className="font-bold">{kanji.literal}</span>
            {kanji.korean_hun_eum && (
              <span className="text-amber-600 dark:text-amber-400">
                {kanji.korean_hun_eum}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/60"
      >
        <div
          className={clsx(
            "relative w-full max-w-lg mx-4 sm:mx-0 max-h-[90vh] flex flex-col",
            "bg-white dark:bg-gray-900 rounded-2xl",
            "shadow-2xl overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>📚</span>
              나만의 단어장
              {words.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({words.length}개)
                </span>
              )}
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

          {/* Mode tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setViewMode("list")}
              className={clsx(
                "flex-1 py-2.5 text-sm font-semibold transition-all relative",
                viewMode === "list"
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
              )}
            >
              목록
              {viewMode === "list" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
            <button
              onClick={() => setViewMode("add")}
              className={clsx(
                "flex-1 py-2.5 text-sm font-semibold transition-all relative",
                viewMode === "add"
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
              )}
            >
              + 추가
              {viewMode === "add" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600" />
              )}
            </button>
            <button
              onClick={startFlashcard}
              disabled={words.length === 0}
              className={clsx(
                "flex-1 py-2.5 text-sm font-semibold transition-all relative",
                viewMode === "flashcard"
                  ? "text-purple-600 dark:text-purple-400"
                  : words.length === 0
                  ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
              )}
            >
              암기 모드
              {viewMode === "flashcard" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="mx-4 mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-2 underline hover:no-underline"
              >
                닫기
              </button>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              </div>
            )}

            {/* List view */}
            {!isLoading && viewMode === "list" && (
              <div className="p-4 space-y-3">
                {words.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <p className="text-lg mb-2">아직 저장된 단어가 없습니다</p>
                    <button
                      onClick={() => setViewMode("add")}
                      className="text-blue-600 hover:underline"
                    >
                      첫 단어 추가하기
                    </button>
                  </div>
                ) : (
                  words.map((word) => (
                    <div
                      key={word.id}
                      className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                              {word.word}
                            </span>
                            <span className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                              {word.pos}
                            </span>
                          </div>
                          <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                            {word.reading}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {word.meaning}
                          </p>
                          {word.memo && (
                            <p className="text-xs text-gray-500 mt-1 italic">
                              {word.memo}
                            </p>
                          )}
                          {/* Kanji chips */}
                          <div className="mt-2">
                            {renderKanjiChips(word.word)}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(word.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Add form */}
            {!isLoading && viewMode === "add" && (
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {/* Helper info banner */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <span className="text-lg">💡</span>
                    영문으로 입력하면 자동으로 히라가나 변환! (예: keizai → けいざい)
                  </p>
                </div>

                {/* 단어 표기 (with kanji suggestions) */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    단어 표기 *
                  </label>
                  <input
                    ref={wordInputRef}
                    type="text"
                    value={formData.word}
                    onChange={(e) => handleWordInputChange(e.target.value)}
                    onFocus={() => {
                      if (kanjiSuggestions.length > 0) setShowSuggestions(true);
                    }}
                    placeholder="예: 経済, 食べる (직접 입력 또는 발음으로 한자 선택)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />

                  {/* Kanji suggestion dropdown */}
                  {showSuggestions && kanjiSuggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                    >
                      <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          &ldquo;{wordInputQuery}&rdquo; 발음 한자 추천 (클릭하여 삽입)
                        </p>
                      </div>
                      <div className="p-2 flex flex-wrap gap-1.5">
                        {kanjiSuggestions.map((kanji) => (
                          <button
                            key={kanji.literal}
                            type="button"
                            onClick={() => insertKanji(kanji)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-800/50 border border-amber-300 dark:border-amber-700 rounded-lg transition-colors"
                          >
                            <span className="text-lg font-bold text-amber-800 dark:text-amber-200">
                              {kanji.literal}
                            </span>
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              {kanji.korean_hun_eum}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Real-time kanji detection */}
                  {formKanjiDetails.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1">포함된 한자:</p>
                      {renderKanjiChips(formData.word, "md")}
                    </div>
                  )}
                </div>

                {/* 읽기 (with automatic hiragana conversion) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    읽기 (히라가나) *
                  </label>
                  <input
                    ref={readingInputRef}
                    type="text"
                    value={formData.reading}
                    onChange={(e) => handleReadingInputChange(e.target.value)}
                    onBlur={handleReadingBlur}
                    placeholder="영문으로 치면 히라가나 자동 변환 (예: keizai → けいざい)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    예: arigatou → ありがとう, taberu → たべる
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    뜻 (한국어) *
                  </label>
                  <input
                    type="text"
                    value={formData.meaning}
                    onChange={(e) => handleMeaningInputChange(e.target.value)}
                    placeholder="例: 안내, 먹다"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    품사
                  </label>
                  <select
                    value={formData.pos}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, pos: e.target.value as WordPOS }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {POS_OPTIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    메모 (선택)
                  </label>
                  <textarea
                    value={formData.memo}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, memo: e.target.value }))
                    }
                    placeholder="예문, 참고사항 등"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !formData.word || !formData.reading || !formData.meaning}
                  className={clsx(
                    "w-full py-2.5 rounded-lg font-medium transition-all",
                    isSubmitting || !formData.word || !formData.reading || !formData.meaning
                      ? "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-green-600 text-white hover:bg-green-700 shadow-lg"
                  )}
                >
                  {isSubmitting ? "저장 중..." : "단어 저장"}
                </button>
              </form>
            )}

            {/* Flashcard view */}
            {!isLoading && viewMode === "flashcard" && deck.length > 0 && currentWord && (
              <div className="p-4">
                {/* Progress */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {currentIndex + 1} / {deck.length}
                  </span>
                  <button
                    onClick={handleShuffle}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    섞기
                  </button>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-purple-600 transition-all"
                    style={{ width: `${((currentIndex + 1) / deck.length) * 100}%` }}
                  />
                </div>

                {/* Card */}
                <div
                  className="flashcard-container w-full h-56 cursor-pointer mb-4"
                  onClick={handleFlip}
                >
                  <div className={clsx("flashcard w-full h-full", isFlipped && "flipped")}>
                    {/* Front */}
                    <div className="flashcard-face flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-200 dark:border-gray-700 shadow-lg">
                      <span className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                        {currentWord.word}
                      </span>
                      <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                        {currentWord.pos}
                      </span>
                      <p className="mt-3 text-sm text-gray-400">클릭하여 뒤집기</p>
                    </div>

                    {/* Back */}
                    <div className="flashcard-face flashcard-back flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 border-2 border-purple-200 dark:border-purple-800 shadow-lg">
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                        {currentWord.reading}
                      </p>
                      <p className="text-lg text-gray-700 dark:text-gray-200 mb-2">
                        {currentWord.meaning}
                      </p>
                      {/* Kanji chips on back */}
                      <div className="mt-2">
                        {renderKanjiChips(currentWord.word, "md")}
                      </div>
                      <p className="mt-3 text-sm text-gray-400">클릭하여 뒤집기</p>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all",
                      currentIndex === 0
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300"
                    )}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    이전
                  </button>

                  <button
                    onClick={handleFlip}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl font-medium bg-purple-600 text-white hover:bg-purple-700 shadow-lg"
                  >
                    뒤집기
                  </button>

                  <button
                    onClick={handleNext}
                    disabled={currentIndex === deck.length - 1}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all",
                      currentIndex === deck.length - 1
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300"
                    )}
                  >
                    다음
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Shortcut hints */}
                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-400">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">Space</kbd> 뒤집기 ·
                    <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded mx-1">←→</kbd> 이전/다음 ·
                    <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">R</kbd> 섞기
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Kanji Modal */}
      {selectedKanji && (
        <KanjiModal kanji={selectedKanji} onClose={() => setSelectedKanji(null)} />
      )}
    </>
  );
}
