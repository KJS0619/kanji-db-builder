"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  loadMasteryRecord,
  markAsMastered,
  markAsUnmastered,
  getMasteredCount,
  MasteryRecord,
} from "@/services/masteryService";
import { useKanjiTTS, getTTSAutoPlaySetting, setTTSAutoPlaySetting } from "@/hooks/useKanjiTTS";
import { SpeakerButton, TTSAutoPlayToggle } from "@/components/SpeakerButton";
import {
  GenericFlashcardPrintModal,
  PrintableCard,
} from "@/components/GenericFlashcardPrintModal";
import {
  WritingPracticeDiffPrintModal,
  WritingPracticeDiffItem,
} from "@/components/WritingPracticeDiffPrintModal";
import { StrokePath, Kanji } from "@/types/kanji";

interface KanjiDiff {
  id: string;
  krTraditional: string;
  jpShinjitai: string;
  krSound: string;
  krMeaning?: string;      // 한국어 뜻 (예: "저물")
  jpOn: string;
  jpKun: string;
  diffCategory: string;
  diffNote?: string;       // 미세 획 차이 설명
}

interface KanjiDiffData {
  version: string;
  description: string;
  total_count: number;
  kanji: KanjiDiff[];
}

interface KanjiDiffModalProps {
  onClose: () => void;
}

// 페이지 사이즈 옵션
type PageSize = 12 | 24 | 48 | "all";
const PAGE_SIZE_OPTIONS: { value: PageSize; label: string }[] = [
  { value: 12, label: "12" },
  { value: 24, label: "24" },
  { value: 48, label: "48" },
  { value: "all", label: "전체" },
];

// 차이 카테고리별 색상
const CATEGORY_COLORS: Record<string, string> = {
  "획수 간략화": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "내부 생략": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "내부 간략화": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  "부분 생략": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "부분 간략화": "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  "전체 간략화": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "부수 변경": "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "통합": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  "형태 변경": "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  "미세 획 차이": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

// 미세 획 차이 카테고리 여부 확인
const isSubtleGlyphDiff = (category: string) => category === "미세 획 차이";

const MASTERY_CATEGORY = "kanji_diff" as const;

export function KanjiDiffModal({ onClose }: KanjiDiffModalProps) {
  const [data, setData] = useState<KanjiDiffData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [shuffledKanji, setShuffledKanji] = useState<KanjiDiff[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  // 학습 완료 상태
  const [masteryRecord, setMasteryRecord] = useState<MasteryRecord>({});
  const [masteryFilter, setMasteryFilter] = useState<"all" | "unmastered" | "mastered">("all");
  const [showMasteryAnimation, setShowMasteryAnimation] = useState(false);

  // 인쇄 모달 상태
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showWritingPracticeModal, setShowWritingPracticeModal] = useState(false);

  // 획순 데이터 (kanji_master.json에서 로드)
  const [strokePathsMap, setStrokePathsMap] = useState<Map<string, StrokePath[]>>(new Map());

  // 페이지네이션 상태
  const [pageSize, setPageSize] = useState<PageSize>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kanjiDiffPageSize");
      if (saved === "12" || saved === "24" || saved === "48") return parseInt(saved) as 12 | 24 | 48;
      if (saved === "all") return "all";
    }
    return 24;
  });
  const [currentPage, setCurrentPage] = useState(1);

  // 선택 상태 (인쇄용)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
        const response = await fetch("/data/kanji_diff_full.json");
        const json: KanjiDiffData = await response.json();
        setData(json);
        setShuffledKanji(json.kanji);

        // 마스터리 데이터 로드
        const record = loadMasteryRecord(MASTERY_CATEGORY);
        setMasteryRecord(record);
      } catch (error) {
        console.error("Failed to load kanji diff data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();

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

  // 카테고리 목록
  const categories = useMemo(() => {
    if (!data) return [];
    const cats = new Set(data.kanji.map(k => k.diffCategory));
    return Array.from(cats).sort();
  }, [data]);

  // 필터링된 한자 (카테고리 + 마스터리 필터)
  const filteredKanji = useMemo(() => {
    let source = isShuffled ? shuffledKanji : (data?.kanji || []);

    // 카테고리 필터
    if (categoryFilter !== "all") {
      source = source.filter(k => k.diffCategory === categoryFilter);
    }

    // 마스터리 필터
    if (masteryFilter === "unmastered") {
      source = source.filter(k => !masteryRecord[k.id]?.isMastered);
    } else if (masteryFilter === "mastered") {
      source = source.filter(k => masteryRecord[k.id]?.isMastered);
    }

    return source;
  }, [data, shuffledKanji, isShuffled, categoryFilter, masteryFilter, masteryRecord]);

  // 현재 카드
  const currentKanji = filteredKanji[currentIndex];

  // 현재 카드의 마스터리 상태
  const isCurrentMastered = currentKanji ? masteryRecord[currentKanji.id]?.isMastered : false;

  // 마스터리 통계
  const masteryStats = useMemo(() => {
    const total = data?.kanji.length || 0;
    const mastered = getMasteredCount(MASTERY_CATEGORY);
    return { total, mastered, remaining: total - mastered };
  }, [data, masteryRecord]);

  // 페이지네이션 계산
  const totalPages = useMemo(() => {
    if (pageSize === "all") return 1;
    return Math.max(1, Math.ceil(filteredKanji.length / pageSize));
  }, [filteredKanji.length, pageSize]);

  // 필터/페이지사이즈 변경 시 페이지 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, masteryFilter, pageSize]);

  // 유효한 페이지 번호 유지
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // 현재 페이지 한자 목록
  const paginatedKanji = useMemo(() => {
    if (pageSize === "all") return filteredKanji;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredKanji.slice(startIndex, startIndex + pageSize);
  }, [filteredKanji, currentPage, pageSize]);

  // 페이지 범위 표시 (예: "17-32 / 45개")
  const pageRangeDisplay = useMemo(() => {
    if (filteredKanji.length === 0) return "0개";
    if (pageSize === "all") return `${filteredKanji.length}개`;
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, filteredKanji.length);
    return `${start}-${end} / ${filteredKanji.length}개`;
  }, [filteredKanji.length, currentPage, pageSize]);

  // 현재 페이지 전체 선택 여부
  const currentPageAllSelected = useMemo(() => {
    if (paginatedKanji.length === 0) return false;
    return paginatedKanji.every((k) => selectedIds.has(k.id));
  }, [paginatedKanji, selectedIds]);

  // 현재 페이지 일부 선택 여부
  const currentPageSomeSelected = useMemo(() => {
    if (paginatedKanji.length === 0) return false;
    const selectedCount = paginatedKanji.filter((k) => selectedIds.has(k.id)).length;
    return selectedCount > 0 && selectedCount < paginatedKanji.length;
  }, [paginatedKanji, selectedIds]);

  // 페이지 사이즈 변경 핸들러
  const handlePageSizeChange = useCallback((newSize: PageSize) => {
    setPageSize(newSize);
    localStorage.setItem("kanjiDiffPageSize", String(newSize));
  }, []);

  // 개별 선택 토글
  const toggleSelectKanji = useCallback((id: string) => {
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

  // 현재 페이지 전체 선택/해제 토글
  const toggleCurrentPageSelection = useCallback(() => {
    if (currentPageAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedKanji.forEach((k) => next.delete(k.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedKanji.forEach((k) => next.add(k.id));
        return next;
      });
    }
  }, [currentPageAllSelected, paginatedKanji]);

  // 필터된 전체 선택
  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(filteredKanji.map((k) => k.id)));
  }, [filteredKanji]);

  // 선택 전체 해제
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // 선택된 한자 목록
  const selectedKanji = useMemo(() => {
    return filteredKanji.filter((k) => selectedIds.has(k.id));
  }, [filteredKanji, selectedIds]);

  // 인쇄용 카드 데이터 변환 (한·일 폰트 분리)
  // 선택된 항목이 있으면 선택된 것만, 없으면 현재 페이지 전체
  const printableCards: PrintableCard[] = useMemo(() => {
    const targetKanji = selectedIds.size > 0 ? selectedKanji : paginatedKanji;
    return targetKanji.map((k) => ({
      id: k.id,
      frontContent: {
        main: `${k.krTraditional} → ${k.jpShinjitai}`,
        mainKr: k.krTraditional,  // 한국어 폰트로 표시
        mainJp: k.jpShinjitai,    // 일본어 폰트로 표시
        sub: k.krMeaning ? `${k.krMeaning} ${k.krSound}` : k.krSound,
      },
      backContent: {
        primary: `음: ${k.jpOn || "-"}`,
        primaryLang: "ja" as const,  // 일본어 폰트
        secondary: `훈: ${k.jpKun || "-"}`,
        secondaryLang: "ja" as const, // 일본어 폰트
        tertiary: k.diffCategory,
        extra: k.diffNote,
      },
    }));
  }, [selectedIds.size, selectedKanji, paginatedKanji]);

  // 쓰기연습용 데이터 변환
  const writingPracticeItems: WritingPracticeDiffItem[] = useMemo(() => {
    const targetKanji = selectedIds.size > 0 ? selectedKanji : paginatedKanji;
    return targetKanji.map((k) => ({
      id: k.id,
      krTraditional: k.krTraditional,
      jpShinjitai: k.jpShinjitai,
      krSound: k.krMeaning ? `${k.krMeaning} ${k.krSound}` : k.krSound,
      jpOn: k.jpOn || "",
      // 한국 정자 획순: 동일 문자면 일본 데이터 사용, 다르면 한국 정자로 검색
      krStrokePaths: k.krTraditional === k.jpShinjitai
        ? strokePathsMap.get(k.jpShinjitai)
        : strokePathsMap.get(k.krTraditional),
      // 일본 신자체 획순
      jpStrokePaths: strokePathsMap.get(k.jpShinjitai),
    }));
  }, [selectedIds.size, selectedKanji, paginatedKanji, strokePathsMap]);

  // 컴포넌트 언마운트 시 TTS 정리
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  // 개별 발음 재생
  const handleSpeak = useCallback(
    (text: string) => {
      // 송독점 제거
      const cleanText = text.replace(/\./g, "").replace(/,/g, " ");
      speak(cleanText);
    },
    [speak]
  );

  // Fisher-Yates 셔플
  const shuffleArray = useCallback((array: KanjiDiff[]) => {
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
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : filteredKanji.length - 1));
    setIsFlipped(false);
  }, [filteredKanji.length, stop]);

  // 다음 카드
  const handleNext = useCallback(() => {
    stop();
    setCurrentIndex((prev) => (prev < filteredKanji.length - 1 ? prev + 1 : 0));
    setIsFlipped(false);
  }, [filteredKanji.length, stop]);

  // 카드 뒤집기 (자동 발음 포함)
  const handleFlip = useCallback(() => {
    const newFlipped = !isFlipped;
    setIsFlipped(newFlipped);

    // 자동재생: 뒷면으로 넘어갈 때 순차 재생
    if (newFlipped && autoPlayEnabled && isSupported && currentKanji) {
      const textsToSpeak: string[] = [];

      // 음독이 있으면 추가
      if (currentKanji.jpOn) {
        textsToSpeak.push(currentKanji.jpOn.split(",")[0].trim());
      }

      // 훈독이 있으면 추가
      if (currentKanji.jpKun) {
        const kunReading = currentKanji.jpKun.split(",")[0].replace(/\./g, "").trim();
        textsToSpeak.push(kunReading);
      }

      if (textsToSpeak.length > 0) {
        speakSequence(textsToSpeak);
      }
    }
  }, [isFlipped, autoPlayEnabled, isSupported, currentKanji, speakSequence]);

  // 마스터리 토글
  const handleToggleMastery = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 뒤집기 방지
    if (!currentKanji) return;

    if (isCurrentMastered) {
      // 학습 완료 해제
      const updated = markAsUnmastered(MASTERY_CATEGORY, currentKanji.id);
      setMasteryRecord(prev => ({ ...prev, [currentKanji.id]: updated }));
    } else {
      // 학습 완료 표시
      const updated = markAsMastered(MASTERY_CATEGORY, currentKanji.id);
      setMasteryRecord(prev => ({ ...prev, [currentKanji.id]: updated }));

      // 애니메이션 표시
      setShowMasteryAnimation(true);
      setTimeout(() => setShowMasteryAnimation(false), 1000);

      // 미완료 필터에서 다음 카드로 자동 이동
      if (masteryFilter === "unmastered" && filteredKanji.length > 1) {
        setTimeout(() => {
          // 현재 인덱스 유지 (필터링으로 다음 카드가 자동으로 현재 위치로 옴)
          // 단, 마지막 카드였다면 인덱스 조정
          if (currentIndex >= filteredKanji.length - 1) {
            setCurrentIndex(0);
          }
          setIsFlipped(false);
        }, 500);
      }
    }
  }, [currentKanji, isCurrentMastered, masteryFilter, filteredKanji.length, currentIndex]);

  // 마스터리 필터 변경
  const handleMasteryFilterChange = useCallback((filter: "all" | "unmastered" | "mastered") => {
    setMasteryFilter(filter);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, []);

  // 키보드 이벤트
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "ArrowRight") handleNext();
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleFlip();
      }
      else if (e.key === "m" || e.key === "M") {
        // M키로 마스터리 토글
        if (currentKanji) {
          if (isCurrentMastered) {
            const updated = markAsUnmastered(MASTERY_CATEGORY, currentKanji.id);
            setMasteryRecord(prev => ({ ...prev, [currentKanji.id]: updated }));
          } else {
            const updated = markAsMastered(MASTERY_CATEGORY, currentKanji.id);
            setMasteryRecord(prev => ({ ...prev, [currentKanji.id]: updated }));
            setShowMasteryAnimation(true);
            setTimeout(() => setShowMasteryAnimation(false), 1000);
          }
        }
      }
      else if (e.key === "s" || e.key === "S") {
        // S키로 발음 재생
        if (currentKanji && isFlipped) {
          const textsToSpeak: string[] = [];
          if (currentKanji.jpOn) textsToSpeak.push(currentKanji.jpOn.split(",")[0].trim());
          if (currentKanji.jpKun) textsToSpeak.push(currentKanji.jpKun.split(",")[0].replace(/\./g, "").trim());
          if (textsToSpeak.length > 0) speakSequence(textsToSpeak);
        }
      }
      else if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext, handleFlip, onClose, currentKanji, isCurrentMastered, isFlipped, speakSequence]);

  // 카테고리 필터 변경
  const handleCategoryChange = useCallback((cat: string) => {
    setCategoryFilter(cat);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!data) {
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

  if (filteredKanji.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center max-w-md">
          <div className="text-4xl mb-4">🎉</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {masteryFilter === "unmastered" ? "모두 학습 완료!" : "해당 카드가 없습니다"}
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            {masteryFilter === "unmastered"
              ? `${masteryStats.mastered}개의 한자를 모두 익혔습니다.`
              : "필터 조건에 맞는 카드가 없습니다."}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => handleMasteryFilterChange("all")}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              전체 보기
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              닫기
            </button>
          </div>
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
                🔄 한·일 차이 한자
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filteredKanji.length}자
              </span>
              {/* 학습 진행률 */}
              <div className="hidden sm:flex items-center gap-2 px-2 py-1 bg-green-100 dark:bg-green-900 rounded-full">
                <span className="text-xs text-green-700 dark:text-green-300">
                  ✓ {masteryStats.mastered}/{masteryStats.total}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* TTS 자동재생 토글 */}
              <TTSAutoPlayToggle
                enabled={autoPlayEnabled}
                onChange={handleAutoPlayChange}
                isSupported={isSupported}
              />
              {/* 쓰기연습 버튼 */}
              <button
                onClick={() => setShowWritingPracticeModal(true)}
                className="flex items-center gap-1 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-green-600 dark:text-green-400"
                title={selectedIds.size > 0 ? `선택된 ${selectedIds.size}개 쓰기연습` : "쓰기연습 PDF"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                {selectedIds.size > 0 && (
                  <span className="text-xs font-medium">
                    ({selectedIds.size})
                  </span>
                )}
              </button>
              {/* 인쇄 버튼 */}
              <button
                onClick={() => setShowPrintModal(true)}
                className="flex items-center gap-1 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={selectedIds.size > 0 ? `선택된 ${selectedIds.size}개 인쇄` : "플래시카드 인쇄"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                {selectedIds.size > 0 && (
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    ({selectedIds.size})
                  </span>
                )}
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
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {/* 뷰 모드 토글 */}
              <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                <button
                  onClick={() => setViewMode("card")}
                  className={`px-3 py-1.5 text-sm ${viewMode === "card" ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-gray-700"}`}
                >
                  카드
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-1.5 text-sm ${viewMode === "list" ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-gray-700"}`}
                >
                  목록
                </button>
              </div>

              {/* 학습 상태 필터 */}
              <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                <button
                  onClick={() => handleMasteryFilterChange("all")}
                  className={`px-3 py-1.5 text-sm ${masteryFilter === "all" ? "bg-purple-500 text-white" : "bg-gray-100 dark:bg-gray-700"}`}
                >
                  전체
                </button>
                <button
                  onClick={() => handleMasteryFilterChange("unmastered")}
                  className={`px-3 py-1.5 text-sm ${masteryFilter === "unmastered" ? "bg-purple-500 text-white" : "bg-gray-100 dark:bg-gray-700"}`}
                >
                  미완료
                </button>
                <button
                  onClick={() => handleMasteryFilterChange("mastered")}
                  className={`px-3 py-1.5 text-sm ${masteryFilter === "mastered" ? "bg-purple-500 text-white" : "bg-gray-100 dark:bg-gray-700"}`}
                >
                  완료
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

              {/* 페이지 사이즈 (목록 뷰 전용) */}
              {viewMode === "list" && (
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(e.target.value === "all" ? "all" : parseInt(e.target.value) as 12 | 24 | 48)}
                  className="px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                >
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}개
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {/* 선택 관련 버튼 (목록 뷰 전용) */}
              {viewMode === "list" && (
                <div className="flex items-center gap-2">
                  {selectedIds.size > 0 && (
                    <>
                      <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                        {selectedIds.size}개 선택
                      </span>
                      <button
                        onClick={deselectAll}
                        className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                      >
                        선택 해제
                      </button>
                    </>
                  )}
                  <button
                    onClick={selectAllFiltered}
                    className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800"
                  >
                    전체 선택 ({filteredKanji.length})
                  </button>
                </div>
              )}

              {/* 카테고리 필터 */}
              <select
                value={categoryFilter}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              >
                <option value="all">전체 카테고리</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-4">
          {viewMode === "card" ? (
            /* 카드 뷰 */
            <div className="flex flex-col items-center">
              {/* 좌우 대조 카드 */}
              <div
                className="flashcard-container w-full max-w-2xl cursor-pointer relative"
                style={{ height: "320px" }}
                onClick={handleFlip}
              >
                {/* 학습 완료 애니메이션 */}
                {showMasteryAnimation && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <div className="text-6xl animate-bounce">✓</div>
                  </div>
                )}

                {/* 마스터리 뱃지 (왼쪽 상단) */}
                {isCurrentMastered && (
                  <div className="absolute top-2 left-2 z-10">
                    <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full font-medium shadow">
                      ✓ 학습 완료
                    </span>
                  </div>
                )}

                <div className={`flashcard w-full h-full ${isFlipped ? "flipped" : ""}`}>
                  {/* 앞면: 좌우 대조 */}
                  <div className="flashcard-face bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-700 dark:to-gray-800 rounded-2xl shadow-lg p-6 flex flex-col">
                    {/* 미세 획 차이 안내 배너 */}
                    {isSubtleGlyphDiff(currentKanji.diffCategory) && (
                      <div className="glyph-diff-banner text-center mb-3 flex items-center justify-center gap-1">
                        <span>🔍</span>
                        <span>폰트 렌더링 주의: 동일 유니코드, 자형 세부 차이</span>
                      </div>
                    )}

                    <div className="flex-1 flex items-center justify-center gap-4 sm:gap-8">
                      {/* 한국 정자체 - lang="ko" + 한국어 폰트 */}
                      <div className="text-center">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">한국 정자</div>
                        <div
                          lang="ko"
                          className="kanji-kr text-7xl sm:text-8xl font-bold text-blue-600 dark:text-blue-400 glyph-highlight"
                        >
                          {currentKanji.krTraditional}
                        </div>
                        {currentKanji.krMeaning && (
                          <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            {currentKanji.krMeaning} {currentKanji.krSound}
                          </div>
                        )}
                      </div>

                      {/* 화살표 */}
                      <div className="text-3xl text-gray-400">→</div>

                      {/* 일본 신자체 - lang="ja" + 일본어 폰트 */}
                      <div className="text-center">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">일본 신자체</div>
                        <div
                          lang="ja"
                          className="kanji-jp text-7xl sm:text-8xl font-bold text-red-600 dark:text-red-400 glyph-highlight"
                        >
                          {currentKanji.jpShinjitai}
                        </div>
                      </div>
                    </div>

                    {/* 카테고리 뱃지 */}
                    <div className="mt-4 flex justify-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        CATEGORY_COLORS[currentKanji.diffCategory] || CATEGORY_COLORS["형태 변경"]
                      }`}>
                        {currentKanji.diffCategory}
                      </span>
                    </div>

                    <div className="text-center text-sm text-gray-400 dark:text-gray-500 mt-2">
                      클릭하여 뒤집기
                    </div>
                  </div>

                  {/* 뒷면: 상세 정보 */}
                  <div className="flashcard-face flashcard-back bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-lg p-6 flex flex-col text-white">
                    <div className="flex-1 flex flex-col justify-center overflow-y-auto">
                      {/* 한자 비교 (작게) - 로케일 폰트 적용 */}
                      <div className="flex justify-center gap-4 mb-3">
                        <span lang="ko" className="kanji-kr text-3xl text-blue-300">{currentKanji.krTraditional}</span>
                        <span className="text-2xl text-gray-500">→</span>
                        <span lang="ja" className="kanji-jp text-3xl text-red-300">{currentKanji.jpShinjitai}</span>
                      </div>

                      {/* 한국 한자음 */}
                      <div className="text-center mb-3">
                        <div className="text-2xl font-bold text-yellow-300">
                          {currentKanji.krMeaning && <span className="mr-1">{currentKanji.krMeaning}</span>}
                          {currentKanji.krSound}
                        </div>
                      </div>

                      {/* 일본어 읽기 */}
                      <div className="space-y-1 text-center mb-3">
                        {currentKanji.jpOn && (
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-gray-400 text-sm">음독: </span>
                            <span lang="ja" className="text-base font-ja">{currentKanji.jpOn}</span>
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
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-gray-400 text-sm">훈독: </span>
                            <span lang="ja" className="text-base font-ja">{currentKanji.jpKun.split(",").slice(0, 3).join(", ")}</span>
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

                      {/* 차이 설명 */}
                      <div className="text-center mb-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          CATEGORY_COLORS[currentKanji.diffCategory] || CATEGORY_COLORS["형태 변경"]
                        }`}>
                          💡 {currentKanji.diffCategory}
                        </span>
                      </div>

                      {/* 미세 획 차이 설명 (diffNote) */}
                      {currentKanji.diffNote && (
                        <div className="text-center mb-3 px-2">
                          <div className="text-xs text-gray-300 bg-gray-700/50 rounded-lg px-3 py-2 leading-relaxed">
                            📝 {currentKanji.diffNote}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 학습 완료 버튼 */}
                    <div className="pt-2 border-t border-gray-700">
                      <button
                        onClick={handleToggleMastery}
                        className={`w-full py-2 rounded-lg font-medium transition-all ${
                          isCurrentMastered
                            ? "bg-gray-600 hover:bg-gray-500 text-gray-300"
                            : "bg-green-600 hover:bg-green-500 text-white"
                        }`}
                      >
                        {isCurrentMastered ? "✓ 학습 완료 (클릭하여 해제)" : "🎯 다 익혔어요!"}
                      </button>
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
                  {currentIndex + 1} / {filteredKanji.length}
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
                ← → 이동 | Space/Enter 뒤집기 | M 학습완료 | S 발음 | ESC 닫기
              </div>
            </div>
          ) : (
            /* 목록 뷰 */
            <div className="flex flex-col gap-4">
              {/* 페이지 헤더 (전체 선택 체크박스 + 페이지 범위) */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentPageAllSelected}
                      ref={(input) => {
                        if (input) {
                          input.indeterminate = currentPageSomeSelected;
                        }
                      }}
                      onChange={toggleCurrentPageSelection}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      현재 페이지 전체 선택
                    </span>
                  </label>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {pageRangeDisplay}
                </span>
              </div>

              {/* 목록 그리드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {paginatedKanji.map((kanji) => {
                  const isMastered = masteryRecord[kanji.id]?.isMastered;
                  const isSelected = selectedIds.has(kanji.id);
                  // 페이지네이션된 목록에서의 인덱스가 아닌 전체 filteredKanji에서의 인덱스 찾기
                  const globalIndex = filteredKanji.findIndex(k => k.id === kanji.id);
                  return (
                    <div
                      key={kanji.id}
                      className={`p-3 rounded-lg transition-colors relative ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500"
                          : isMastered
                          ? "bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50"
                          : "bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
                      }`}
                    >
                      {/* 체크박스 (왼쪽 상단) */}
                      <div className="absolute top-2 left-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectKanji(kanji.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </div>

                      {/* 마스터리 뱃지 (오른쪽 상단) */}
                      {isMastered && (
                        <div className="absolute top-2 right-2">
                          <span className="text-green-500 text-lg">✓</span>
                        </div>
                      )}

                      {/* 클릭 가능 영역 */}
                      <div
                        onClick={() => {
                          setCurrentIndex(globalIndex);
                          setViewMode("card");
                        }}
                        className="cursor-pointer pl-6"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <span lang="ko" className="kanji-kr text-2xl text-blue-600 dark:text-blue-400">{kanji.krTraditional}</span>
                            <span className="text-gray-400">→</span>
                            <span lang="ja" className="kanji-jp text-2xl text-red-600 dark:text-red-400">{kanji.jpShinjitai}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {kanji.krMeaning && <span className="mr-1">{kanji.krMeaning}</span>}
                              {kanji.krSound}
                            </div>
                            <div lang="ja" className="text-xs text-gray-500 dark:text-gray-400 truncate font-ja">{kanji.jpOn}</div>
                          </div>
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            CATEGORY_COLORS[kanji.diffCategory] || CATEGORY_COLORS["형태 변경"]
                          }`}>
                            {kanji.diffCategory}
                          </span>
                          {isSubtleGlyphDiff(kanji.diffCategory) && (
                            <span className="text-xs text-yellow-600 dark:text-yellow-400" title="미세 획 차이 - 폰트 렌더링 주의">🔍</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 페이지네이션 컨트롤 */}
              {pageSize !== "all" && totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-sm rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ««
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>
                  <span className="px-3 py-1 text-sm font-medium">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 text-sm rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    »»
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 인쇄 모달 */}
      {showPrintModal && (
        <GenericFlashcardPrintModal
          title="한·일 차이 한자"
          cards={printableCards}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* 쓰기연습 모달 */}
      {showWritingPracticeModal && (
        <WritingPracticeDiffPrintModal
          title="한·일 차이 한자"
          items={writingPracticeItems}
          onClose={() => setShowWritingPracticeModal(false)}
        />
      )}
    </div>
  );
}
