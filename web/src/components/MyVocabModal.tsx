"use client";

import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { Kanji, JLPT_COLORS } from "@/types/kanji";
import { CustomWord, WordFormData, POS_OPTIONS, WordPOS, JlptLevel, JLPT_LEVEL_OPTIONS } from "@/types/word";
import { fetchWords, addWord, deleteWord, updateWord } from "@/services/vocabService";
import { extractKanji, createKanjiMap, getKanjiDetails } from "@/utils/kanjiParser";
import { KanjiModal } from "./KanjiModal";
import { BulkImportModal } from "./BulkImportModal";
import { FlashcardPrintModal } from "./FlashcardPrintModal";
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

type PageSize = 8 | 16 | 32 | "all";
const PAGE_SIZE_OPTIONS: { value: PageSize; label: string }[] = [
  { value: 8, label: "8" },
  { value: 16, label: "16" },
  { value: 32, label: "32" },
  { value: "all", label: "전체" },
];

export function MyVocabModal({ kanjiList, onClose }: MyVocabModalProps) {
  const [words, setWords] = useState<CustomWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedKanji, setSelectedKanji] = useState<Kanji | null>(null);

  // Filter state
  const [jlptFilter, setJlptFilter] = useState<JlptLevel | "all" | "none">("all");

  // Pagination state
  const [pageSize, setPageSize] = useState<PageSize>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("vocabPageSize");
      if (saved === "8" || saved === "16" || saved === "32") return parseInt(saved) as 8 | 16 | 32;
      if (saved === "all") return "all";
    }
    return 16;
  });
  const [currentPage, setCurrentPage] = useState(1);

  // Bulk import modal state
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Selection state for flashcard printing
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState<WordFormData>({
    word: "",
    reading: "",
    meaning: "",
    pos: "명사",
    jlpt_level: null,
    source: "",
    memo: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingWordId, setEditingWordId] = useState<string | null>(null);

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

  // Handle word input change with kanji suggestions AND hiragana conversion
  const handleWordInputChange = useCallback(
    (value: string) => {
      // Convert romaji to hiragana (IMEMode keeps partial romaji like 'n' as-is)
      // This allows typing verbs like "taberu" → "たべる"
      const converted = wanakana.toHiragana(value, { IMEMode: true });
      setFormData((prev) => ({ ...prev, word: converted }));

      // Extract the last segment after any kanji for suggestion
      const lastSegment = converted.match(/[a-zA-Zぁ-んァ-ン가-힣]+$/)?.[0] || "";
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

  // Finalize word hiragana conversion on blur
  const handleWordBlur = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      word: wanakana.toHiragana(prev.word, { IMEMode: false }),
    }));
    setShowSuggestions(false);
  }, []);

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
  // No longer filters Korean - instead use inputMode="latin" hint on the input
  const handleReadingInputChange = useCallback((value: string) => {
    // Convert romaji to hiragana (non-romaji characters pass through)
    const converted = wanakana.toHiragana(value, { IMEMode: true });
    setFormData((prev) => ({ ...prev, reading: converted }));
  }, []);

  // Finalize hiragana conversion on blur (convert any remaining romaji)
  const handleReadingBlur = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      reading: wanakana.toHiragana(prev.reading, { IMEMode: false }),
    }));
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

  // Handle form submit (add or update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.word || !formData.reading || !formData.meaning) return;

    try {
      setIsSubmitting(true);

      if (editingWordId) {
        // Update existing word
        const updatedWord = await updateWord(editingWordId, formData);
        setWords((prev) =>
          prev.map((w) => (w.id === editingWordId ? updatedWord : w))
        );
        setEditingWordId(null);
      } else {
        // Add new word
        const newWord = await addWord(formData);
        setWords((prev) => [newWord, ...prev]);
      }

      setFormData({ word: "", reading: "", meaning: "", pos: "명사", jlpt_level: null, source: "", memo: "" });
      setViewMode("list");
    } catch (err) {
      setError(err instanceof Error ? err.message : editingWordId ? "단어 수정에 실패했습니다." : "단어 추가에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Start editing a word
  const startEdit = useCallback((word: CustomWord) => {
    setFormData({
      word: word.word,
      reading: word.reading,
      meaning: word.meaning,
      pos: word.pos as WordPOS,
      jlpt_level: word.jlpt_level || null,
      source: word.source || "",
      memo: word.memo || "",
    });
    setEditingWordId(word.id);
    setViewMode("add");
  }, []);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setFormData({ word: "", reading: "", meaning: "", pos: "명사", jlpt_level: null, source: "", memo: "" });
    setEditingWordId(null);
    setViewMode("list");
  }, []);

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

  // Selection handlers for flashcard printing
  const toggleSelectWord = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    const filteredWords = words.filter((word) => {
      if (jlptFilter === "all") return true;
      if (jlptFilter === "none") return !word.jlpt_level;
      return word.jlpt_level === jlptFilter;
    });
    setSelectedIds(new Set(filteredWords.map((w) => w.id)));
  }, [words, jlptFilter]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedWords = useMemo(() => {
    return words.filter((w) => selectedIds.has(w.id));
  }, [words, selectedIds]);

  // Filtered words by JLPT
  const filteredWords = useMemo(() => {
    return words.filter((word) => {
      if (jlptFilter === "all") return true;
      if (jlptFilter === "none") return !word.jlpt_level;
      return word.jlpt_level === jlptFilter;
    });
  }, [words, jlptFilter]);

  // Pagination calculations
  const totalPages = useMemo(() => {
    if (pageSize === "all") return 1;
    return Math.max(1, Math.ceil(filteredWords.length / pageSize));
  }, [filteredWords.length, pageSize]);

  // Reset to page 1 when filter or pageSize changes
  useEffect(() => {
    setCurrentPage(1);
  }, [jlptFilter, pageSize]);

  // Ensure currentPage is valid
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Paginated words for current page
  const paginatedWords = useMemo(() => {
    if (pageSize === "all") return filteredWords;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredWords.slice(startIndex, startIndex + pageSize);
  }, [filteredWords, currentPage, pageSize]);

  // Current page range display (e.g., "17-32 / 45개")
  const pageRangeDisplay = useMemo(() => {
    if (filteredWords.length === 0) return "0개";
    if (pageSize === "all") return `${filteredWords.length}개`;
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, filteredWords.length);
    return `${start}-${end} / ${filteredWords.length}개`;
  }, [filteredWords.length, currentPage, pageSize]);

  // Check if all items on current page are selected
  const currentPageAllSelected = useMemo(() => {
    if (paginatedWords.length === 0) return false;
    return paginatedWords.every((w) => selectedIds.has(w.id));
  }, [paginatedWords, selectedIds]);

  // Check if some (but not all) items on current page are selected
  const currentPageSomeSelected = useMemo(() => {
    if (paginatedWords.length === 0) return false;
    const selectedCount = paginatedWords.filter((w) => selectedIds.has(w.id)).length;
    return selectedCount > 0 && selectedCount < paginatedWords.length;
  }, [paginatedWords, selectedIds]);

  // Handle page size change and save to localStorage
  const handlePageSizeChange = useCallback((newSize: PageSize) => {
    setPageSize(newSize);
    localStorage.setItem("vocabPageSize", String(newSize));
  }, []);

  // Toggle select all on current page
  const toggleCurrentPageSelection = useCallback(() => {
    if (currentPageAllSelected) {
      // Deselect all on current page
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedWords.forEach((w) => next.delete(w.id));
        return next;
      });
    } else {
      // Select all on current page
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedWords.forEach((w) => next.add(w.id));
        return next;
      });
    }
  }, [currentPageAllSelected, paginatedWords]);

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
              onClick={() => {
                if (editingWordId) {
                  setEditingWordId(null);
                  setFormData({ word: "", reading: "", meaning: "", pos: "명사", jlpt_level: null, source: "", memo: "" });
                }
                setViewMode("add");
              }}
              className={clsx(
                "flex-1 py-2.5 text-sm font-semibold transition-all relative",
                viewMode === "add" && !editingWordId
                  ? "text-green-600 dark:text-green-400"
                  : viewMode === "add" && editingWordId
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
              )}
            >
              {viewMode === "add" && editingWordId ? "✏️ 수정" : "+ 추가"}
              {viewMode === "add" && (
                <div className={clsx(
                  "absolute bottom-0 left-0 right-0 h-0.5",
                  editingWordId ? "bg-amber-600" : "bg-green-600"
                )} />
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
                {/* Filter bar */}
                {words.length > 0 && (
                  <div className="space-y-2 pb-3 border-b border-gray-200 dark:border-gray-700">
                    {/* Row 1: Filters and page info */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-gray-500 dark:text-gray-400">JLPT:</label>
                        <select
                          value={jlptFilter}
                          onChange={(e) => setJlptFilter(e.target.value as JlptLevel | "all" | "none")}
                          className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="all">전체</option>
                          {JLPT_LEVEL_OPTIONS.map((level) => (
                            <option key={level} value={level}>{level}</option>
                          ))}
                          <option value="none">미지정</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-gray-500 dark:text-gray-400">페이지당:</label>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            const val = e.target.value;
                            handlePageSizeChange(val === "all" ? "all" : parseInt(val) as 8 | 16 | 32);
                          }}
                          className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        >
                          {PAGE_SIZE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                        {pageRangeDisplay}
                      </span>
                    </div>
                    {/* Row 2: Selection controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Page select checkbox */}
                      <button
                        type="button"
                        onClick={toggleCurrentPageSelection}
                        className={clsx(
                          "flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors",
                          currentPageAllSelected
                            ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                        )}
                      >
                        <span
                          className={clsx(
                            "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                            currentPageAllSelected
                              ? "bg-blue-600 border-blue-600 text-white"
                              : currentPageSomeSelected
                              ? "bg-blue-200 border-blue-400 dark:bg-blue-800 dark:border-blue-600"
                              : "border-gray-300 dark:border-gray-600"
                          )}
                        >
                          {currentPageAllSelected && (
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          {currentPageSomeSelected && !currentPageAllSelected && (
                            <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                          )}
                        </span>
                        이 페이지 선택
                      </button>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <button
                        type="button"
                        onClick={selectAllFiltered}
                        className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                      >
                        필터 전체 선택
                      </button>
                      <button
                        type="button"
                        onClick={deselectAll}
                        className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                      >
                        선택 해제
                      </button>
                      {selectedIds.size > 0 && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">|</span>
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            {selectedIds.size}개 선택됨
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowPrintModal(true)}
                            className="ml-auto px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-all flex items-center gap-1.5 shadow-md hover:shadow-lg"
                            style={{
                              background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            플래시카드 인쇄
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

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
                ) : filteredWords.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <p className="text-lg mb-2">해당 필터에 맞는 단어가 없습니다</p>
                    <button
                      onClick={() => setJlptFilter("all")}
                      className="text-blue-600 hover:underline"
                    >
                      전체 보기
                    </button>
                  </div>
                ) : (
                  paginatedWords.map((word) => (
                    <div
                      key={word.id}
                      className={clsx(
                        "p-3 rounded-xl border transition-colors",
                        selectedIds.has(word.id)
                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                          : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => toggleSelectWord(word.id)}
                          className={clsx(
                            "flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors",
                            selectedIds.has(word.id)
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "border-gray-300 dark:border-gray-600 hover:border-blue-400"
                          )}
                        >
                          {selectedIds.has(word.id) && (
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                              {word.word}
                            </span>
                            <span className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                              {word.pos}
                            </span>
                            {word.jlpt_level && (
                              <span
                                className="px-1.5 py-0.5 text-xs font-semibold rounded text-white"
                                style={{ backgroundColor: JLPT_COLORS[word.jlpt_level] }}
                              >
                                {word.jlpt_level}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                            {word.reading}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {word.meaning}
                          </p>
                          {word.source && (
                            <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                              📖 {word.source}
                            </p>
                          )}
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
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => startEdit(word)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="수정"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(word.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="삭제"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* Pagination controls */}
                {filteredWords.length > 0 && pageSize !== "all" && totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={clsx(
                        "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                        currentPage === 1
                          ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                          : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                    >
                      ◀ 이전
                    </button>

                    {/* Page numbers */}
                    <div className="flex items-center gap-1 mx-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) => {
                          // Show first, last, current, and neighbors
                          if (page === 1 || page === totalPages) return true;
                          if (Math.abs(page - currentPage) <= 1) return true;
                          return false;
                        })
                        .reduce<(number | "...")[]>((acc, page, idx, arr) => {
                          if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                            acc.push("...");
                          }
                          acc.push(page);
                          return acc;
                        }, [])
                        .map((item, idx) =>
                          item === "..." ? (
                            <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">
                              ...
                            </span>
                          ) : (
                            <button
                              key={item}
                              type="button"
                              onClick={() => setCurrentPage(item)}
                              className={clsx(
                                "w-8 h-8 text-sm font-medium rounded-lg transition-colors",
                                currentPage === item
                                  ? "bg-blue-600 text-white"
                                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                              )}
                            >
                              {item}
                            </button>
                          )
                        )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className={clsx(
                        "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                        currentPage === totalPages
                          ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                          : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                    >
                      다음 ▶
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Add/Edit form */}
            {!isLoading && viewMode === "add" && (
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {/* PDF Import Button */}
                {!editingWordId && (
                  <button
                    type="button"
                    onClick={() => setShowBulkImport(true)}
                    className="w-full py-3 rounded-xl font-medium text-white transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                    style={{
                      background: "linear-gradient(to right, #f97316, #f59e0b)",
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    PDF에서 일괄 가져오기
                  </button>
                )}

                {!editingWordId && (
                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                    <span className="flex-shrink mx-3 text-xs text-gray-400">또는 직접 입력</span>
                    <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                  </div>
                )}

                {/* Editing mode banner */}
                {editingWordId && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                      <span className="text-lg">✏️</span>
                      수정 모드 - 변경 후 저장 버튼을 눌러주세요
                    </p>
                  </div>
                )}

                {/* Helper info banner */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <span className="text-lg">💡</span>
                    단어/읽기: 영문 입력 → 히라가나 변환 (taberu → たべる)
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
                    onBlur={handleWordBlur}
                    placeholder="한자/히라가나 직접입력 또는 romaji→히라가나"
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
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevent blur from firing
                              insertKanji(kanji);
                            }}
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
                    placeholder="영문으로 입력 → 히라가나 자동 변환"
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
                    lang="ko"
                    value={formData.meaning}
                    onChange={(e) => setFormData((prev) => ({ ...prev, meaning: e.target.value }))}
                    placeholder="한국어로 뜻 입력"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                      JLPT 레벨
                    </label>
                    <select
                      value={formData.jlpt_level || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          jlpt_level: e.target.value ? (e.target.value as JlptLevel) : null,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">선택 안함</option>
                      {JLPT_LEVEL_OPTIONS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    출처 (선택)
                  </label>
                  <input
                    type="text"
                    value={formData.source || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, source: e.target.value }))
                    }
                    placeholder="예: 2024 N1 기출, 교재 p.45"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
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

                <div className="flex gap-2">
                  {editingWordId && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex-1 py-2.5 rounded-lg font-medium transition-all bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      취소
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.word || !formData.reading || !formData.meaning}
                    className={clsx(
                      "flex-1 py-2.5 rounded-lg font-medium transition-all",
                      isSubmitting || !formData.word || !formData.reading || !formData.meaning
                        ? "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                        : editingWordId
                        ? "bg-amber-600 text-white hover:bg-amber-700 shadow-lg"
                        : "bg-green-600 text-white hover:bg-green-700 shadow-lg"
                    )}
                  >
                    {isSubmitting ? "저장 중..." : editingWordId ? "수정 완료" : "단어 저장"}
                  </button>
                </div>
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

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <BulkImportModal
          onClose={() => setShowBulkImport(false)}
          onImportComplete={() => {
            loadWords();
          }}
        />
      )}

      {/* Flashcard Print Modal */}
      {showPrintModal && selectedWords.length > 0 && (
        <FlashcardPrintModal
          words={selectedWords}
          kanjiList={kanjiList}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </>
  );
}
