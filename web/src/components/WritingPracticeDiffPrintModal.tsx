"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { StrokePath, Kanji } from "@/types/kanji";

/**
 * 한·일 차이 한자 쓰기연습 데이터 인터페이스
 */
export interface WritingPracticeDiffItem {
  id: string;
  krTraditional: string;    // 한국 정자 (예: 學)
  jpShinjitai: string;      // 일본 신자체 (예: 学)
  krSound: string;          // 한국 훈음 (예: "배울 학")
  jpOn: string;             // 일본어 음독
  krStrokePaths?: StrokePath[];  // 한국 정자 획순 (없을 수 있음)
  jpStrokePaths?: StrokePath[];  // 일본 신자체 획순
}

export interface WritingPracticeDiffPrintModalProps {
  title: string;
  items: WritingPracticeDiffItem[];
  onClose: () => void;
}

// 한·일 차이 한자는 레이아웃이 넓어서 페이지당 6자
const ITEMS_PER_PAGE = 6;

export function WritingPracticeDiffPrintModal({
  title,
  items,
  onClose,
}: WritingPracticeDiffPrintModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [practiceBoxCount, setPracticeBoxCount] = useState(2);

  // 페이지 분할
  const pages = useMemo(() => {
    const result: WritingPracticeDiffItem[][] = [];
    for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
      result.push(items.slice(i, i + ITEMS_PER_PAGE));
    }
    return result;
  }, [items]);

  // SVG 획순 생성 (획 번호 포함) - 크기 확대 버전
  const createStrokeSVG = useCallback((strokePaths: StrokePath[] | undefined, strokeColor: string = "#333"): string => {
    if (!strokePaths || strokePaths.length === 0) {
      return `<svg viewBox="0 0 109 109" style="width: 100%; height: 100%;"></svg>`;
    }

    const pathElements = strokePaths.map((stroke, i) => `
      <path d="${stroke.path}" fill="none" stroke="${strokeColor}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
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

  // 가이드 한자 SVG (회색) - 획순 데이터 있을 때
  const createGuideSVGWithPaths = useCallback((strokePaths: StrokePath[] | undefined, color: string = "#d1d5db"): string => {
    if (!strokePaths || strokePaths.length === 0) {
      return `<svg viewBox="0 0 109 109" style="width: 100%; height: 100%;"></svg>`;
    }

    const pathElements = strokePaths.map((stroke) => `
      <path d="${stroke.path}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    `).join("");

    return `
      <svg viewBox="0 0 109 109" style="width: 100%; height: 100%;">
        <line x1="54.5" y1="0" x2="54.5" y2="109" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="2,2"/>
        <line x1="0" y1="54.5" x2="109" y2="54.5" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="2,2"/>
        ${pathElements}
      </svg>
    `;
  }, []);

  // 가이드 한자 (텍스트) - 획순 데이터 없을 때 (세로 가운데 정렬 강화)
  const createGuideTextCell = useCallback((char: string, color: string, fontFamily: string): string => {
    // SVG text 사용으로 세로 가운데 정렬 보장, 글씨 크기 확대 (65)
    return `
      <svg viewBox="0 0 109 109" style="width: 100%; height: 100%;">
        <line x1="54.5" y1="0" x2="54.5" y2="109" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="2,2"/>
        <line x1="0" y1="54.5" x2="109" y2="54.5" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="2,2"/>
        <text x="54.5" y="58" text-anchor="middle" dominant-baseline="central" fill="${color}" font-size="65" font-family="${fontFamily}" font-weight="500">${char}</text>
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

  // 셀 크기 상수 (확대 버전)
  const CELL_SIZE = "22mm";  // 셀 너비
  const ROW_HEIGHT = "32mm"; // 행 높이 (세로 확대)

  // 한 줄(한자) HTML 생성 - 한·일 대비 레이아웃
  const createRowHTML = useCallback((item: WritingPracticeDiffItem): string => {
    // 정보 셀: 훈음 + 음독 (세로 가운데 정렬)
    const infoCell = `
      <td style="width: 22mm; height: ${ROW_HEIGHT}; text-align: center; padding: 4px; border: 1px solid #ccc; vertical-align: middle; background: #f9fafb;">
        <div style="font-size: 11pt; font-weight: 600; color: #1e40af; font-family: 'Noto Serif KR', serif; line-height: 1.3;">${item.krSound}</div>
        <div style="font-size: 9pt; color: #666; font-family: 'Noto Sans JP', sans-serif; margin-top: 3px;">${item.jpOn || "-"}</div>
      </td>
    `;

    // 한국 정자 섹션 (세로 가운데 정렬, 배경색 제거)
    const krGuideCell = item.krStrokePaths && item.krStrokePaths.length > 0
      ? `<td style="width: ${CELL_SIZE}; height: ${ROW_HEIGHT}; padding: 2px; border: 1px solid #ccc; vertical-align: middle;">${createGuideSVGWithPaths(item.krStrokePaths, "#93c5fd")}</td>`
      : `<td style="width: ${CELL_SIZE}; height: ${ROW_HEIGHT}; padding: 2px; border: 1px solid #ccc; vertical-align: middle;">${createGuideTextCell(item.krTraditional, "#93c5fd", "'Noto Serif KR', serif")}</td>`;

    const krStrokeCell = item.krStrokePaths && item.krStrokePaths.length > 0
      ? `<td style="width: ${CELL_SIZE}; height: ${ROW_HEIGHT}; padding: 2px; border: 1px solid #ccc; vertical-align: middle;">${createStrokeSVG(item.krStrokePaths, "#1e40af")}</td>`
      : `<td style="width: ${CELL_SIZE}; height: ${ROW_HEIGHT}; padding: 2px; border: 1px solid #ccc; vertical-align: middle; text-align: center; font-size: 9pt; color: #666;">-</td>`;

    const krPracticeBoxes = Array(practiceBoxCount).fill(null).map(() =>
      `<td style="width: ${CELL_SIZE}; height: ${ROW_HEIGHT}; padding: 2px; border: 1px solid #ccc; vertical-align: middle;">${createEmptyBoxSVG()}</td>`
    ).join("");

    // 일본 신자체 섹션 (세로 가운데 정렬, 배경색 제거)
    const jpGuideCell = item.jpStrokePaths && item.jpStrokePaths.length > 0
      ? `<td style="width: ${CELL_SIZE}; height: ${ROW_HEIGHT}; padding: 2px; border: 1px solid #ccc; vertical-align: middle;">${createGuideSVGWithPaths(item.jpStrokePaths, "#fca5a5")}</td>`
      : `<td style="width: ${CELL_SIZE}; height: ${ROW_HEIGHT}; padding: 2px; border: 1px solid #ccc; vertical-align: middle;">${createGuideTextCell(item.jpShinjitai, "#fca5a5", "'Noto Sans JP', sans-serif")}</td>`;

    const jpStrokeCell = item.jpStrokePaths && item.jpStrokePaths.length > 0
      ? `<td style="width: ${CELL_SIZE}; height: ${ROW_HEIGHT}; padding: 2px; border: 1px solid #ccc; vertical-align: middle;">${createStrokeSVG(item.jpStrokePaths, "#dc2626")}</td>`
      : `<td style="width: ${CELL_SIZE}; height: ${ROW_HEIGHT}; padding: 2px; border: 1px solid #ccc; vertical-align: middle; text-align: center; font-size: 9pt; color: #666;">-</td>`;

    const jpPracticeBoxes = Array(practiceBoxCount).fill(null).map(() =>
      `<td style="width: ${CELL_SIZE}; height: ${ROW_HEIGHT}; padding: 2px; border: 1px solid #ccc; vertical-align: middle;">${createEmptyBoxSVG()}</td>`
    ).join("");

    return `<tr>${infoCell}${krGuideCell}${krStrokeCell}${krPracticeBoxes}${jpGuideCell}${jpStrokeCell}${jpPracticeBoxes}</tr>`;
  }, [createGuideSVGWithPaths, createGuideTextCell, createStrokeSVG, createEmptyBoxSVG, practiceBoxCount]);

  // 페이지 HTML 생성
  const createPageHTML = useCallback((pageItems: WritingPracticeDiffItem[], pageIndex: number): HTMLDivElement => {
    const page = document.createElement("div");
    page.style.cssText = `
      width: 210mm;
      height: 297mm;
      padding: 12mm 8mm;
      box-sizing: border-box;
      background: #ffffff !important;
      font-family: 'Noto Sans JP', 'Noto Sans KR', sans-serif;
    `;

    // 헤더
    const headerHTML = `
      <div style="text-align: center; margin-bottom: 8mm; border-bottom: 2px solid #333; padding-bottom: 4mm;">
        <h1 style="font-size: 14pt; font-weight: bold; margin: 0; color: #333;">${title} - 쓰기연습</h1>
        <p style="font-size: 9pt; color: #666; margin-top: 2mm;">🇰🇷 한국 정자 vs 🇯🇵 일본 신자체 | 페이지 ${pageIndex + 1} / ${pages.length}</p>
      </div>
    `;

    // 테이블 헤더 - 한국/일본 구분 (세로 가운데 정렬)
    const krPracticeHeaders = Array(practiceBoxCount).fill(null).map((_, i) =>
      `<th style="width: 22mm; padding: 6px; border: 1px solid #ccc; font-size: 9pt; font-weight: 600; background: #dbeafe; vertical-align: middle;">연습${i + 1}</th>`
    ).join("");

    const jpPracticeHeaders = Array(practiceBoxCount).fill(null).map((_, i) =>
      `<th style="width: 22mm; padding: 6px; border: 1px solid #ccc; font-size: 9pt; font-weight: 600; background: #fee2e2; vertical-align: middle;">연습${i + 1}</th>`
    ).join("");

    const tableHeaderHTML = `
      <tr>
        <th rowspan="2" style="width: 22mm; padding: 8px; border: 1px solid #ccc; font-size: 10pt; font-weight: 600; background: #f3f4f6; vertical-align: middle;">훈음<br/><span style="font-size: 8pt; color: #666;">音読み</span></th>
        <th colspan="${2 + practiceBoxCount}" style="padding: 6px; border: 1px solid #ccc; font-size: 10pt; font-weight: 700; background: #dbeafe; color: #1e40af; vertical-align: middle;">🇰🇷 한국 정자</th>
        <th colspan="${2 + practiceBoxCount}" style="padding: 6px; border: 1px solid #ccc; font-size: 10pt; font-weight: 700; background: #fee2e2; color: #dc2626; vertical-align: middle;">🇯🇵 일본 신자체</th>
      </tr>
      <tr>
        <th style="width: 22mm; padding: 6px; border: 1px solid #ccc; font-size: 9pt; font-weight: 600; background: #dbeafe; vertical-align: middle;">안내</th>
        <th style="width: 22mm; padding: 6px; border: 1px solid #ccc; font-size: 9pt; font-weight: 600; background: #dbeafe; vertical-align: middle;">획순</th>
        ${krPracticeHeaders}
        <th style="width: 22mm; padding: 6px; border: 1px solid #ccc; font-size: 9pt; font-weight: 600; background: #fee2e2; vertical-align: middle;">안내</th>
        <th style="width: 22mm; padding: 6px; border: 1px solid #ccc; font-size: 9pt; font-weight: 600; background: #fee2e2; vertical-align: middle;">획순</th>
        ${jpPracticeHeaders}
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

    // 범례
    const legendHTML = `
      <div style="margin-top: 8mm; padding: 4mm; background: #f9fafb; border-radius: 4px; font-size: 8pt; color: #666;">
        <strong>💡 사용 방법:</strong>
        <span style="color: #1e40af;">●</span> 파란색 = 한국 정자 |
        <span style="color: #dc2626;">●</span> 빨간색 = 일본 신자체 |
        획순의 빨간 원 안 숫자를 따라 쓰세요
      </div>
    `;

    page.innerHTML = headerHTML + tableHTML + legendHTML;
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
      pdf.save(`${safeTitle}_한일차이_쓰기연습_${new Date().toISOString().slice(0, 10)}.pdf`);
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
        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-red-50 dark:from-blue-900/20 dark:to-red-900/20 border-b border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            🇰🇷🇯🇵 <strong>한·일 차이 한자</strong> 전용 쓰기연습 PDF
            <br />
            📝 A4 용지 기준, 한 페이지에 <strong>6자</strong>가 배치됩니다.
            <br />
            ✨ 한국 정자(파랑)와 일본 신자체(빨강)를 나란히 비교하며 연습하세요.
          </p>
        </div>

        {/* 연습칸 개수 설정 */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">연습칸 개수 (한국/일본 각각):</span>
          <div className="flex gap-2">
            {[1, 2, 3].map((count) => (
              <button
                key={count}
                onClick={() => setPracticeBoxCount(count)}
                className={clsx(
                  "px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                  practiceBoxCount === count
                    ? "bg-gradient-to-r from-blue-600 to-red-600 text-white"
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
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th rowSpan={2} className="border border-gray-300 dark:border-gray-600 px-2 py-1 w-16 bg-gray-200 dark:bg-gray-700">
                      훈음<br /><span className="text-[10px] text-gray-500">音読み</span>
                    </th>
                    <th colSpan={2 + practiceBoxCount} className="border border-gray-300 dark:border-gray-600 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                      🇰🇷 한국 정자
                    </th>
                    <th colSpan={2 + practiceBoxCount} className="border border-gray-300 dark:border-gray-600 px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
                      🇯🇵 일본 신자체
                    </th>
                  </tr>
                  <tr>
                    <th className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 bg-blue-50 dark:bg-blue-900/50 text-[10px]">안내</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 bg-blue-50 dark:bg-blue-900/50 text-[10px]">획순</th>
                    {Array(practiceBoxCount).fill(null).map((_, i) => (
                      <th key={`kr-${i}`} className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 bg-blue-50 dark:bg-blue-900/50 text-[10px]">연습</th>
                    ))}
                    <th className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 bg-red-50 dark:bg-red-900/50 text-[10px]">안내</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 bg-red-50 dark:bg-red-900/50 text-[10px]">획순</th>
                    {Array(practiceBoxCount).fill(null).map((_, i) => (
                      <th key={`jp-${i}`} className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 bg-red-50 dark:bg-red-900/50 text-[10px]">연습</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pages[0]?.slice(0, 4).map((item) => (
                    <tr key={item.id}>
                      <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center bg-gray-50 dark:bg-gray-700">
                        <div className="font-medium text-blue-700 dark:text-blue-300">{item.krSound}</div>
                        <div className="text-[10px] text-gray-500">{item.jpOn || "-"}</div>
                      </td>
                      {/* 한국 정자 */}
                      <td className="border border-gray-300 dark:border-gray-600 p-1 bg-blue-50 dark:bg-blue-900/30">
                        <div className="w-8 h-8 mx-auto flex items-center justify-center text-blue-300 dark:text-blue-600 text-xl font-bold">
                          {item.krTraditional}
                        </div>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 p-1 bg-blue-50 dark:bg-blue-900/30">
                        <div className="w-8 h-8 mx-auto flex items-center justify-center text-blue-500 text-[10px]">
                          {item.krStrokePaths ? `${item.krStrokePaths.length}획` : "-"}
                        </div>
                      </td>
                      {Array(practiceBoxCount).fill(null).map((_, i) => (
                        <td key={`kr-p-${i}`} className="border border-blue-200 dark:border-blue-800 p-1 bg-blue-50/50">
                          <div className="w-8 h-8 mx-auto border border-dashed border-blue-300 dark:border-blue-600 rounded"></div>
                        </td>
                      ))}
                      {/* 일본 신자체 */}
                      <td className="border border-gray-300 dark:border-gray-600 p-1 bg-red-50 dark:bg-red-900/30">
                        <div className="w-8 h-8 mx-auto flex items-center justify-center text-red-300 dark:text-red-600 text-xl font-bold">
                          {item.jpShinjitai}
                        </div>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 p-1 bg-red-50 dark:bg-red-900/30">
                        <div className="w-8 h-8 mx-auto flex items-center justify-center text-red-500 text-[10px]">
                          {item.jpStrokePaths ? `${item.jpStrokePaths.length}획` : "-"}
                        </div>
                      </td>
                      {Array(practiceBoxCount).fill(null).map((_, i) => (
                        <td key={`jp-p-${i}`} className="border border-red-200 dark:border-red-800 p-1 bg-red-50/50">
                          <div className="w-8 h-8 mx-auto border border-dashed border-red-300 dark:border-red-600 rounded"></div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages[0]?.length > 4 && (
              <p className="text-xs text-gray-400 text-center mt-2">
                ... 외 {pages[0].length - 4}자 더
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
                : "bg-gradient-to-r from-blue-600 to-red-600 text-white hover:from-blue-700 hover:to-red-700 shadow-lg"
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
