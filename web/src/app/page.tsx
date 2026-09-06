"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Kanji, KanjiData, JlptLevel, GradeFilter } from "@/types/kanji";
import { Header } from "@/components/Header";
import { FilterBar } from "@/components/FilterBar";
import { KanjiGrid } from "@/components/KanjiGrid";
import { KanjiModal } from "@/components/KanjiModal";
import { FlashcardModal } from "@/components/FlashcardModal";

export default function Home() {
  const [kanjiData, setKanjiData] = useState<Kanji[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedKanji, setSelectedKanji] = useState<Kanji | null>(null);
  const [showFlashcard, setShowFlashcard] = useState(false);

  // 필터 상태
  const [jlptFilter, setJlptFilter] = useState<JlptLevel>("all");
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 데이터 로드
  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch("/data/kanji_master.json");
        const data: KanjiData = await response.json();
        setKanjiData(data.kanji);
      } catch (error) {
        console.error("Failed to load kanji data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // 다크 모드 초기화
  useEffect(() => {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  // 다크 모드 토글
  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const newValue = !prev;
      if (newValue) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return newValue;
    });
  }, []);

  // 필터링된 데이터
  const filteredKanji = useMemo(() => {
    let result = kanjiData;

    // JLPT 필터
    if (jlptFilter !== "all") {
      result = result.filter((k) => k.jlpt_level === jlptFilter);
    }

    // 학년 필터
    if (gradeFilter !== "all") {
      result = result.filter((k) => k.grade === gradeFilter);
    }

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((k) => {
        // 한자 자체
        if (k.literal.includes(query)) return true;
        // 한국어 훈음
        if (k.korean_hun_eum?.toLowerCase().includes(query)) return true;
        // 일본어 음독
        if (k.ja_on.some((r) => r.toLowerCase().includes(query))) return true;
        // 일본어 훈독
        if (k.ja_kun.some((r) => r.toLowerCase().includes(query))) return true;
        // 영문 의미
        if (k.meanings_en.some((m) => m.toLowerCase().includes(query)))
          return true;
        return false;
      });
    }

    return result;
  }, [kanjiData, jlptFilter, gradeFilter, searchQuery]);

  // 통계
  const stats = useMemo(() => {
    const jlptCounts: Record<string, number> = {
      N5: 0,
      N4: 0,
      N3: 0,
      N2: 0,
      N1: 0,
    };
    kanjiData.forEach((k) => {
      if (jlptCounts[k.jlpt_level] !== undefined) {
        jlptCounts[k.jlpt_level]++;
      }
    });
    return {
      total: kanjiData.length,
      jlpt: jlptCounts,
    };
  }, [kanjiData]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        totalCount={stats.total}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onOpenFlashcard={() => setShowFlashcard(true)}
      />

      <FilterBar
        jlptFilter={jlptFilter}
        gradeFilter={gradeFilter}
        searchQuery={searchQuery}
        jlptCounts={stats.jlpt}
        onJlptChange={setJlptFilter}
        onGradeChange={setGradeFilter}
        onSearchChange={setSearchQuery}
      />

      <main className="flex-1 px-2 sm:px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              {filteredKanji.length === stats.total
                ? `전체 ${stats.total}자`
                : `${filteredKanji.length}자 / ${stats.total}자`}
            </div>
            <KanjiGrid
              kanjiList={filteredKanji}
              onKanjiClick={setSelectedKanji}
            />
          </>
        )}
      </main>

      {selectedKanji && (
        <KanjiModal
          kanji={selectedKanji}
          onClose={() => setSelectedKanji(null)}
        />
      )}

      {showFlashcard && (
        <FlashcardModal
          kanjiList={kanjiData}
          onClose={() => setShowFlashcard(false)}
        />
      )}
    </div>
  );
}
