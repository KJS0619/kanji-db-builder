"use client";

import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";
import { StrokePath } from "@/types/kanji";

/**
 * 쓰기연습 데이터 인터페이스
 */
export interface WritingPracticeItem {
  id: string;
  literal: string;           // 한자
  hunEum: string;            // 훈음 (예: "하늘 천")
  strokePaths?: StrokePath[]; // 획순 SVG 데이터 (없으면 빈칸)
}

export interface WritingPracticePrintModalProps {
  title: string;
  items: WritingPracticeItem[];
  onClose: () => void;
}

// 셀 크기 확대로 페이지당 8자로 조정
const ITEMS_PER_PAGE = 8;

// 셀 크기 상수 (확대 버전)
const CELL_SIZE = "22mm";   // 셀 너비/높이
const ROW_HEIGHT = "26mm";  // 행 높이

export function WritingPracticePrintModal({
  title,
  items,
  onClose,
}: WritingPracticePrintModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [practiceBoxCount, setPracticeBoxCount] = useState(5);

  // 페이지 분할
  const pages = useMemo(() => {
    const result: WritingPracticeItem[][] = [];
    for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
      result.push(items.slice(i, i + ITEMS_PER_PAGE));
    }
    return result;
  }, [items]);

  // SVG 획순 생성 (획 번호 포함) - 크기 확대 버전
  const createStrokeSVG = useCallback((strokePaths: StrokePath[] | undefined): string => {
    if (!strokePaths || strokePaths.length === 0) {
      return `<svg viewBox="0 0 109 109" style="width: 100%; height: 100%;"></svg>`;
    }

    const pathElements = strokePaths.map((stroke, i) => `
      <path d="${stroke.path}" fill="none" stroke="#222" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${stroke.start_x}" cy="${stroke.start_y}" r="7" fill="#dc2626"/>
      <text x="${stroke.start_x}" y="${stroke.start_y}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="9" font-weight="bold">${i + 1}</text>
    `).join("");

    return `
      <svg viewBox="0 0 109 109" style="width: 100%; height: 100%;">
        <line x1="54.5" y1="0" x2="54.5" y2="109" stroke="#ccc" stroke-width="0.5" stroke-dasharray="2,2"/>
        <line x1="0" y1="54.5" x2="109" y2="54.5" stroke="#ccc" stroke-width="0.5" stroke-dasharray="2,2"/>
        ${pathElements}
      </svg>
    `;
  }, []);

  // 가이드 한자 SVG (진한 회색 - 선명하게)
  const createGuideSVG = useCallback((strokePaths: StrokePath[] | undefined): string => {
    if (!strokePaths || strokePaths.length === 0) {
      return `<svg viewBox="0 0 109 109" style="width: 100%; height: 100%;"></svg>`;
    }

    const pathElements = strokePaths.map((stroke) => `
      <path d="${stroke.path}" fill="none" stroke="#555" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    `).join("");

    return `
      <svg viewBox="0 0 109 109" style="width: 100%; height: 100%;">
        <line x1="54.5" y1="0" x2="54.5" y2="109" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="2,2"/>
        <line x1="0" y1="54.5" x2="109" y2="54.5" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="2,2"/>
        ${pathElements}
      </svg>
    `;
  }, []);

  // 빈 연습 박스 SVG
  const createEmptyBoxSVG = useCallback((): string => {
    return `
      <svg viewBox="0 0 109 109" style="width: 100%; height: 100%;">
        <rect x="1" y="1" width="107" height="107" fill="none" stroke="#e5e7eb" stroke-width="1"/>
        <line x1="54.5" y1="0" x2="54.5" y2="109" stroke="#f3f4f6" stroke-width="0.5" stroke-dasharray="2,2"/>
        <line x1="0" y1="54.5" x2="109" y2="54.5" stroke="#f3f4f6" stroke-width="0.5" stroke-dasharray="2,2"/>
      </svg>
    `;
  }, []);

  // 한 줄(한자) HTML 생성 - 셀 크기 확대 버전
  const createRowHTML = useCallback((item: WritingPracticeItem): string => {
    const hunEumCell = `<td style="width: 24mm; height: ${ROW_HEIGHT}; text-align: center; padding: 4px; border: 1px solid #ccc; font-size: 12pt; font-weight: 600; vertical-align: middle; font-family: 'Noto Serif KR', serif;">${item.hunEum}</td>`;

    const guideCell = `<td style="width: ${CELL_SIZE}; height: ${ROW_HEIGHT}; padding: 2px; border: 1px solid #ccc; vertical-align: middle;">${createGuideSVG(item.strokePaths)}</td>`;

    const strokeCell = `<td style="width: ${CELL_SIZE}; height: ${ROW_HEIGHT}; padding: 2px; border: 1px solid #ccc; vertical-align: middle;">${createStrokeSVG(item.strokePaths)}</td>`;

    const practiceBoxes = Array(practiceBoxCount).fill(null).map(() =>
      `<td style="width: ${CELL_SIZE}; height: ${ROW_HEIGHT}; padding: 2px; border: 1px solid #ccc; vertical-align: middle;">${createEmptyBoxSVG()}</td>`
    ).join("");

    return `<tr>${hunEumCell}${guideCell}${strokeCell}${practiceBoxes}</tr>`;
  }, [createGuideSVG, createStrokeSVG, createEmptyBoxSVG, practiceBoxCount]);

  // 페이지 HTML 생성
  const createPageHTML = useCallback((pageItems: WritingPracticeItem[], pageIndex: number): HTMLDivElement => {
    const page = document.createElement("div");
    page.style.cssText = `
      width: 210mm;
      height: 297mm;
      padding: 15mm 10mm;
      box-sizing: border-box;
      background: #ffffff !important;
      font-family: 'Noto Sans JP', 'Noto Sans KR', sans-serif;
    `;

    // 헤더
    const headerHTML = `
      <div style="text-align: center; margin-bottom: 10mm; border-bottom: 2px solid #333; padding-bottom: 5mm;">
        <h1 style="font-size: 16pt; font-weight: bold; margin: 0; color: #333;">${title}</h1>
        <p style="font-size: 10pt; color: #666; margin-top: 3mm;">페이지 ${pageIndex + 1} / ${pages.length}</p>
      </div>
    `;

    // 테이블 헤더 - 셀 크기 확대 버전
    const tableHeaderHTML = `
      <tr style="background: #f3f4f6;">
        <th style="width: 24mm; padding: 8px; border: 1px solid #ccc; font-size: 11pt; font-weight: 600;">훈음</th>
        <th style="width: ${CELL_SIZE}; padding: 8px; border: 1px solid #ccc; font-size: 11pt; font-weight: 600;">안내</th>
        <th style="width: ${CELL_SIZE}; padding: 8px; border: 1px solid #ccc; font-size: 11pt; font-weight: 600;">획순</th>
        ${Array(practiceBoxCount).fill(null).map((_, i) =>
          `<th style="width: ${CELL_SIZE}; padding: 8px; border: 1px solid #ccc; font-size: 11pt; font-weight: 600;">연습${i + 1}</th>`
        ).join("")}
      </tr>
    `;

    // 테이블 본문
    const rowsHTML = pageItems.map(item => createRowHTML(item)).join("");

    // 전체 테이블
    const tableHTML = `
      <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
        ${tableHeaderHTML}
        ${rowsHTML}
      </table>
    `;

    page.innerHTML = headerHTML + tableHTML;
    return page;
  }, [title, pages.length, practiceBoxCount, createRowHTML]);

  // PDF 생성
  const handleGeneratePDF = useCallback(async () => {
    setIsGenerating(true);

    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = 210;
      const pdfHeight = 297;

      for (let i = 0; i < pages.length; i++) {
        const pageDiv = createPageHTML(pages[i], i);

        const wrapper = document.createElement("div");
        wrapper.style.cssText = `
          position: absolute;
          left: -9999px;
          top: 0;
          background: #ffffff !important;
        `;
        wrapper.appendChild(pageDiv);
        document.body.appendChild(wrapper);

        const canvas = await html2canvas(pageDiv, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        });

        document.body.removeChild(wrapper);

        const imgData = canvas.toDataURL("image/png");

        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      }

      const safeTitle = title.replace(/[^a-zA-Z0-9가-힣]/g, "_");
      pdf.save(`${safeTitle}_쓰기연습_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("PDF 생성에 실패했습니다.");
    } finally {
      setIsGenerating(false);
    }
  }, [pages, createPageHTML, title]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70">
      <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>✏️</span>
            {title} 쓰기연습
            <span className="text-sm font-normal text-gray-500">
              ({items.length}자 → {pages.length}페이지)
            </span>
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info */}
        <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-800">
          <p className="text-sm text-green-700 dark:text-green-300">
            📝 A4 용지 기준, 한 페이지에 <strong>8자</strong>가 배치됩니다.
            <br />
            🖊️ 각 한자마다 <strong>훈음 · 안내 · 획순 · 연습칸</strong>이 포함됩니다.
            <br />
            ✨ 획순 번호가 표시된 칸을 참고하여 연습하세요.
          </p>
        </div>

        {/* 연습칸 개수 설정 */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">연습칸 개수:</span>
          <div className="flex gap-2">
            {[3, 4, 5, 6].map((count) => (
              <button
                key={count}
                onClick={() => setPracticeBoxCount(count)}
                className={clsx(
                  "px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                  practiceBoxCount === count
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                )}
              >
                {count}개
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 text-center">미리보기 (첫 페이지)</p>

            {/* 테이블 미리보기 */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-200 dark:bg-gray-700">
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 w-20">훈음</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 w-12">안내</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 w-12">획순</th>
                    {Array(practiceBoxCount).fill(null).map((_, i) => (
                      <th key={i} className="border border-gray-300 dark:border-gray-600 px-2 py-1 w-12">연습{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pages[0]?.slice(0, 5).map((item) => (
                    <tr key={item.id}>
                      <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center font-medium">
                        {item.hunEum}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 p-1">
                        <div className="w-10 h-10 mx-auto flex items-center justify-center text-gray-300 dark:text-gray-600 text-2xl font-bold">
                          {item.literal}
                        </div>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 p-1">
                        <div className="w-10 h-10 mx-auto flex items-center justify-center text-gray-500 text-lg">
                          {item.strokePaths ? `${item.strokePaths.length}획` : "-"}
                        </div>
                      </td>
                      {Array(practiceBoxCount).fill(null).map((_, i) => (
                        <td key={i} className="border border-gray-300 dark:border-gray-600 p-1">
                          <div className="w-10 h-10 mx-auto border border-dashed border-gray-300 dark:border-gray-600 rounded"></div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages[0]?.length > 5 && (
              <p className="text-xs text-gray-400 text-center mt-2">
                ... 외 {pages[0].length - 5}자 더
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleGeneratePDF}
            disabled={isGenerating || items.length === 0}
            className={clsx(
              "flex-1 py-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
              isGenerating || items.length === 0
                ? "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-green-600 to-teal-600 text-white hover:from-green-700 hover:to-teal-700 shadow-lg"
            )}
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                생성 중...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PDF 다운로드
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
