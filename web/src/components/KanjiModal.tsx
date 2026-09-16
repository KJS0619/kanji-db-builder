"use client";

import { useEffect, useCallback, useState } from "react";
import { Kanji, JLPT_COLORS } from "@/types/kanji";
import { StrokePlayer } from "./StrokePlayer";
import { DrawingCanvas } from "./DrawingCanvas";
import clsx from "clsx";

interface KanjiDiffEntry {
  krTraditional: string;
  jpShinjitai: string;
  krSound: string;
  diffCategory?: string;
}

interface KanjiModalProps {
  kanji: Kanji;
  onClose: () => void;
}

type TabType = "stroke" | "draw" | "compare";
type CharVariant = "jp" | "kr";

export function KanjiModal({ kanji, onClose }: KanjiModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("stroke");
  const [charVariant, setCharVariant] = useState<CharVariant>("jp");
  const [koreanTraditional, setKoreanTraditional] = useState<string | null>(null);
  const [krSound, setKrSound] = useState<string | null>(null);
  const [diffCategory, setDiffCategory] = useState<string | null>(null);

  // 한·일 차이 데이터 로드
  useEffect(() => {
    fetch("/data/kanji_diff_full.json")
      .then((res) => res.json())
      .then((data) => {
        const entry = data.kanji.find((e: KanjiDiffEntry) => e.jpShinjitai === kanji.literal);
        if (entry && entry.krTraditional !== kanji.literal) {
          setKoreanTraditional(entry.krTraditional);
          setKrSound(entry.krSound);
          setDiffCategory(entry.diffCategory || null);
        }
      })
      .catch((err) => console.error("Failed to load kanji diff data:", err));
  }, [kanji.literal]);

  const hasDiff = koreanTraditional !== null;

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // 배경 클릭으로 닫기
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-backdrop bg-black/50"
      onClick={handleBackdropClick}
    >
      <div
        className={clsx(
          "relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto",
          "bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl",
          "shadow-2xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
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

        {/* 헤더 */}
        <div className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            {/* 한자 - 차이가 있으면 두 글자 표시 */}
            <div className="flex-shrink-0">
              {hasDiff ? (
                <div className="flex items-center gap-2">
                  {/* 일본 신자체 */}
                  <div
                    className={clsx(
                      "w-20 h-20 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all",
                      charVariant === "jp"
                        ? "bg-red-50 dark:bg-red-900/30 ring-2 ring-red-400"
                        : "bg-gray-50 dark:bg-gray-800 hover:bg-red-50/50 dark:hover:bg-red-900/20"
                    )}
                    onClick={() => setCharVariant("jp")}
                  >
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      {kanji.literal}
                    </span>
                    <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">🇯🇵 日本</span>
                  </div>

                  <span className="text-gray-400 text-xl">/</span>

                  {/* 한국 정자 */}
                  <div
                    className={clsx(
                      "w-20 h-20 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all",
                      charVariant === "kr"
                        ? "bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-400"
                        : "bg-gray-50 dark:bg-gray-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/20"
                    )}
                    onClick={() => setCharVariant("kr")}
                  >
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      {koreanTraditional}
                    </span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">🇰🇷 韓国</span>
                  </div>
                </div>
              ) : (
                <div className="w-24 h-24 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <span className="text-6xl font-bold text-gray-900 dark:text-white">
                    {kanji.literal}
                  </span>
                </div>
              )}
            </div>

            {/* 기본 정보 */}
            <div className="flex-1 min-w-0">
              {/* 한국어 훈음 */}
              {kanji.korean_hun_eum && (
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-1">
                  {kanji.korean_hun_eum}
                </p>
              )}

              {/* 한·일 차이 알림 */}
              {hasDiff && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mb-1 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  한·일 자형이 다릅니다
                </p>
              )}

              {/* 배지들 */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span
                  className={clsx(
                    "px-2 py-0.5 text-xs font-bold text-white rounded",
                    JLPT_COLORS[kanji.jlpt_level]
                  )}
                >
                  {kanji.jlpt_level}
                </span>
                <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                  {kanji.grade <= 6 ? `小${kanji.grade}` : "中学+"}
                </span>
                <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                  {kanji.stroke_count}획
                </span>
                {kanji.frequency && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                    #{kanji.frequency}
                  </span>
                )}
              </div>

              {/* Unicode */}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                U+{kanji.unicode_hex.toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* 독음 정보 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          {/* 음독 */}
          {kanji.ja_on.length > 0 && (
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-16 text-sm font-medium text-gray-500 dark:text-gray-400">
                音読み
              </span>
              <span className="text-sm text-gray-900 dark:text-white">
                {kanji.ja_on.join(", ")}
              </span>
            </div>
          )}

          {/* 훈독 */}
          {kanji.ja_kun.length > 0 && (
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-16 text-sm font-medium text-gray-500 dark:text-gray-400">
                訓読み
              </span>
              <span className="text-sm text-gray-900 dark:text-white">
                {kanji.ja_kun.join(", ")}
              </span>
            </div>
          )}

          {/* 영문 의미 */}
          {kanji.meanings_en.length > 0 && (
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-16 text-sm font-medium text-gray-500 dark:text-gray-400">
                English
              </span>
              <span className="text-sm text-gray-900 dark:text-white">
                {kanji.meanings_en.join(", ")}
              </span>
            </div>
          )}
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("stroke")}
            className={clsx(
              "flex-1 py-3 px-4 text-sm font-semibold transition-colors relative",
              activeTab === "stroke"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              획순 보기
            </span>
            {activeTab === "stroke" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("draw")}
            className={clsx(
              "flex-1 py-3 px-4 text-sm font-semibold transition-colors relative",
              activeTab === "draw"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              따라 쓰기
            </span>
            {activeTab === "draw" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
            )}
          </button>

          {/* 비교 탭 - 한·일 차이가 있을 때만 표시 */}
          {hasDiff && (
            <button
              onClick={() => setActiveTab("compare")}
              className={clsx(
                "flex-1 py-3 px-4 text-sm font-semibold transition-colors relative",
                activeTab === "compare"
                  ? "text-purple-600 dark:text-purple-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                비교
              </span>
              {activeTab === "compare" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400" />
              )}
            </button>
          )}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="p-4">
          {/* 일본 신자체 선택 시 */}
          {(!hasDiff || charVariant === "jp") && (
            <>
              {activeTab === "stroke" && kanji.stroke_paths.length > 0 && (
                <StrokePlayer kanji={kanji} />
              )}

              {activeTab === "stroke" && kanji.stroke_paths.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  획순 데이터가 없습니다
                </div>
              )}

              {activeTab === "draw" && (
                <DrawingCanvas kanji={kanji} />
              )}
            </>
          )}

          {/* 한국 정자 선택 시 */}
          {hasDiff && charVariant === "kr" && (
            <>
              {activeTab === "stroke" && (
                <div className="flex flex-col items-center py-6">
                  {/* 큰 한국 정자 표시 */}
                  <div className="w-48 h-48 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 rounded-2xl mb-4 border-2 border-blue-200 dark:border-blue-800">
                    <span className="text-[120px] font-bold text-gray-900 dark:text-white leading-none" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                      {koreanTraditional}
                    </span>
                  </div>

                  {/* 훈음 */}
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                    {krSound || kanji.korean_hun_eum}
                  </p>

                  {/* 안내 메시지 */}
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-4 max-w-sm">
                    <p className="text-sm text-amber-700 dark:text-amber-300 text-center">
                      <span className="font-semibold">⚠️ 획순 데이터 없음</span>
                      <br />
                      한국 정자(正字)는 KanjiVG 데이터베이스에 포함되어 있지 않아 획순을 표시할 수 없습니다.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "draw" && (
                <div className="flex flex-col items-center py-6">
                  {/* 한국 정자 가이드 */}
                  <div className="w-64 h-64 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-2xl mb-4 border-2 border-dashed border-gray-300 dark:border-gray-600 relative">
                    <span className="text-[140px] font-bold text-gray-200 dark:text-gray-700 leading-none absolute" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                      {koreanTraditional}
                    </span>
                    <p className="text-sm text-gray-500 dark:text-gray-400 absolute bottom-4">
                      참고용 (따라쓰기 불가)
                    </p>
                  </div>

                  {/* 안내 */}
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    한국 정자는 획순 데이터가 없어 따라쓰기를 지원하지 않습니다.
                    <br />
                    🇯🇵 日本 탭에서 일본 신자체로 연습해 보세요.
                  </p>
                </div>
              )}
            </>
          )}

          {/* 비교 탭 콘텐츠 */}
          {activeTab === "compare" && hasDiff && (
            <div className="py-4">
              {/* 좌우 대비형 레이아웃 */}
              <div className="flex gap-4">
                {/* 일본 신자체 */}
                <div className="flex-1 flex flex-col items-center">
                  <div className="text-sm font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                    🇯🇵 日本 신자체
                  </div>
                  <div className="w-full aspect-square max-w-[160px] flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-2xl border-2 border-red-200 dark:border-red-800">
                    <span className="text-[80px] font-bold text-gray-900 dark:text-white leading-none">
                      {kanji.literal}
                    </span>
                  </div>
                  <div className="mt-3 text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {kanji.stroke_count}획
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {kanji.ja_on.length > 0 ? kanji.ja_on[0] : "-"}
                    </p>
                  </div>
                </div>

                {/* 구분선 */}
                <div className="flex flex-col items-center justify-center">
                  <div className="w-px h-full bg-gray-200 dark:bg-gray-700 relative">
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* 한국 정자 */}
                <div className="flex-1 flex flex-col items-center">
                  <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1">
                    🇰🇷 韓国 정자
                  </div>
                  <div className="w-full aspect-square max-w-[160px] flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 rounded-2xl border-2 border-blue-200 dark:border-blue-800">
                    <span className="text-[80px] font-bold text-gray-900 dark:text-white leading-none" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                      {koreanTraditional}
                    </span>
                  </div>
                  <div className="mt-3 text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {krSound?.split(" ")[1] || "-"}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {krSound || kanji.korean_hun_eum}
                    </p>
                  </div>
                </div>
              </div>

              {/* 차이점 설명 */}
              <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-bold text-purple-700 dark:text-purple-300">차이점</span>
                </div>
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  {diffCategory || "획수 간략화"}
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                  일본에서는 1946년 당용한자표(當用漢字表) 발표 이후 간략화된 신자체(新字體)를 사용합니다.
                  한국에서는 전통적인 정자(正字)를 유지하고 있습니다.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
