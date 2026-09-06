"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Kanji, JLPT_COLORS } from "@/types/kanji";
import clsx from "clsx";

interface KanjiGridProps {
  kanjiList: Kanji[];
  onKanjiClick: (kanji: Kanji) => void;
}

// 반응형 열 수 계산
function getColumns(): number {
  if (typeof window === "undefined") return 5;
  const width = window.innerWidth;
  if (width < 480) return 5;
  if (width < 640) return 6;
  if (width < 768) return 7;
  if (width < 1024) return 8;
  if (width < 1280) return 10;
  return 12;
}

export function KanjiGrid({ kanjiList, onKanjiClick }: KanjiGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(5);

  // 클라이언트에서 열 수 계산
  useEffect(() => {
    const updateColumns = () => setColumns(getColumns());
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  const rowCount = Math.ceil(kanjiList.length / columns);

  // 가상화 설정
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 80, []),
    overscan: 5,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="h-[calc(100vh-220px)] overflow-auto"
      style={{ contain: "strict" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const rowItems = kanjiList.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              className="grid gap-1.5 sm:gap-2 px-0.5"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {rowItems.map((kanji, i) => (
                <KanjiCard
                  key={kanji.unicode_hex}
                  kanji={kanji}
                  onClick={() => onKanjiClick(kanji)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface KanjiCardProps {
  kanji: Kanji;
  onClick: () => void;
}

function KanjiCard({ kanji, onClick }: KanjiCardProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "kanji-card relative flex flex-col items-center justify-center",
        "aspect-square rounded-lg",
        "bg-white dark:bg-gray-800",
        "border border-gray-200 dark:border-gray-700",
        "hover:border-blue-400 dark:hover:border-blue-500",
        "cursor-pointer transition-all"
      )}
    >
      {/* JLPT 배지 */}
      <span
        className={clsx(
          "absolute top-0.5 right-0.5 px-1 py-0.5 text-[9px] font-bold text-white rounded",
          JLPT_COLORS[kanji.jlpt_level] || "bg-gray-400"
        )}
      >
        {kanji.jlpt_level}
      </span>

      {/* 한자 */}
      <span className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
        {kanji.literal}
      </span>

      {/* 한국어 훈음 */}
      {kanji.korean_hun_eum && (
        <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate max-w-full px-1">
          {kanji.korean_hun_eum}
        </span>
      )}
    </button>
  );
}
