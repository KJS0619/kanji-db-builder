"use client";

import { JlptLevel, GradeFilter, JLPT_COLORS } from "@/types/kanji";
import clsx from "clsx";

interface FilterBarProps {
  jlptFilter: JlptLevel;
  gradeFilter: GradeFilter;
  searchQuery: string;
  jlptCounts: Record<string, number>;
  onJlptChange: (level: JlptLevel) => void;
  onGradeChange: (grade: GradeFilter) => void;
  onSearchChange: (query: string) => void;
}

const JLPT_LEVELS: JlptLevel[] = ["all", "N5", "N4", "N3", "N2", "N1"];
const GRADES: { value: GradeFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: 1, label: "1학년" },
  { value: 2, label: "2학년" },
  { value: 3, label: "3학년" },
  { value: 4, label: "4학년" },
  { value: 5, label: "5학년" },
  { value: 6, label: "6학년" },
  { value: 8, label: "중학+" },
];

export function FilterBar({
  jlptFilter,
  gradeFilter,
  searchQuery,
  jlptCounts,
  onJlptChange,
  onGradeChange,
  onSearchChange,
}: FilterBarProps) {
  return (
    <div className="sticky top-[57px] z-30 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 px-2 sm:px-4 py-3 space-y-3">
      {/* 검색 바 */}
      <div className="relative max-w-xl">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="한자, 훈음, 음독, 훈독, 의미 검색..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* JLPT 필터 */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 self-center mr-1">
          JLPT
        </span>
        {JLPT_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => onJlptChange(level)}
            className={clsx(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
              jlptFilter === level
                ? level === "all"
                  ? "bg-gray-800 dark:bg-white text-white dark:text-gray-900"
                  : `${JLPT_COLORS[level]} text-white`
                : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
            )}
          >
            {level === "all" ? "전체" : level}
            {level !== "all" && (
              <span className="ml-1 text-xs opacity-80">
                {jlptCounts[level] || 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 학년 필터 */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 self-center mr-1">
          학년
        </span>
        {GRADES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onGradeChange(value)}
            className={clsx(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
              gradeFilter === value
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
