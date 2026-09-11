"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { CustomWord } from "@/types/word";
import { Kanji } from "@/types/kanji";
import { createKanjiMap, getKanjiDetails } from "@/utils/kanjiParser";
import clsx from "clsx";

interface FlashcardPrintModalProps {
  words: CustomWord[];
  kanjiList: Kanji[];
  onClose: () => void;
}

// Card data with kanji details
interface CardData {
  word: CustomWord;
  kanjiDetails: Kanji[];
}

const CARDS_PER_PAGE = 8;

export function FlashcardPrintModal({
  words,
  kanjiList,
  onClose,
}: FlashcardPrintModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewMode, setPreviewMode] = useState<"front" | "back">("front");
  const printRef = useRef<HTMLDivElement>(null);

  // Create kanji map for O(1) lookup
  const kanjiMap = useMemo(() => createKanjiMap(kanjiList), [kanjiList]);

  // Prepare card data with kanji details
  const cardData: CardData[] = useMemo(() => {
    return words.map((word) => ({
      word,
      kanjiDetails: getKanjiDetails(word.word, kanjiMap),
    }));
  }, [words, kanjiMap]);

  // Split into pages (8 cards per page)
  const pages = useMemo(() => {
    const result: CardData[][] = [];
    for (let i = 0; i < cardData.length; i += CARDS_PER_PAGE) {
      result.push(cardData.slice(i, i + CARDS_PER_PAGE));
    }
    return result;
  }, [cardData]);

  // Reverse rows for "flip on short edge" (위로 넘김/짧은 면으로 뒤집기) duplex printing
  // When flipping upward, top becomes bottom, so we reverse row order
  const reverseRowsForDuplex = useCallback((cards: CardData[]): CardData[] => {
    const result: CardData[] = [];
    // Original: row 0 (0,1), row 1 (2,3), row 2 (4,5), row 3 (6,7)
    // Reversed: row 3 (6,7), row 2 (4,5), row 1 (2,3), row 0 (0,1)
    for (let row = 3; row >= 0; row--) {
      const leftIdx = row * 2;
      const rightIdx = row * 2 + 1;
      result.push(cards[leftIdx] || ({} as CardData));
      result.push(cards[rightIdx] || ({} as CardData));
    }
    return result;
  }, []);

  // Create front card HTML (word + pos)
  const createFrontCardHTML = useCallback((data: CardData): string => {
    return `
      <div style="text-align: center;">
        <div style="font-size: 32pt; font-weight: 900; color: #000000; margin-bottom: 8px; font-family: 'Noto Sans JP', sans-serif;">
          ${data.word.word}
        </div>
        <div style="font-size: 11pt; font-weight: 600; color: #000000; background: #d4d4d4; padding: 2px 10px; border-radius: 10px; display: inline-block;">
          ${data.word.pos}
        </div>
      </div>
    `;
  }, []);

  // Create back card HTML (reading + meaning + kanji details + memo)
  const createBackCardHTML = useCallback((data: CardData): string => {
    const kanjiHunEum = data.kanjiDetails
      .filter((k) => k.korean_hun_eum)
      .map((k) => `${k.literal}: ${k.korean_hun_eum}`)
      .join(" · ");

    return `
      <div style="text-align: center; width: 100%;">
        <div style="font-size: 18pt; color: #1e1b4b; font-weight: 800; margin-bottom: 4px; font-family: 'Noto Sans JP', sans-serif;">
          ${data.word.reading}
        </div>
        <div style="font-size: 14pt; color: #000000; font-weight: 700; margin-bottom: 6px;">
          ${data.word.meaning}
        </div>
        ${
          kanjiHunEum
            ? `<div style="font-size: 9pt; color: #000000; font-weight: 500; margin-bottom: 4px; padding: 0 4px;">
            ${kanjiHunEum}
          </div>`
            : ""
        }
        ${
          data.word.memo
            ? `<div style="font-size: 9pt; color: #000000; font-weight: 500; border-top: 1px dashed #999; padding-top: 4px; margin-top: 4px; font-style: italic;">
            ${data.word.memo}
          </div>`
            : ""
        }
      </div>
    `;
  }, []);

  // Create page HTML element
  const createPageHTML = useCallback(
    (
      pageCards: CardData[],
      side: "front" | "back"
    ): HTMLDivElement => {
      const page = document.createElement("div");
      page.style.cssText = `
        width: 210mm;
        height: 297mm;
        padding: 10mm;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(4, 1fr);
        gap: 0;
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #000000 !important;
      `;

      // For back side with "flip on short edge" (위로 넘김) duplex printing,
      // reverse rows so cards align when paper is flipped upward
      const orderedCards = side === "back" ? reverseRowsForDuplex(pageCards) : pageCards;

      // Fill with cards (pad with empty if less than 8)
      for (let i = 0; i < CARDS_PER_PAGE; i++) {
        const cardData = orderedCards[i];
        const card = document.createElement("div");

        if (cardData && cardData.word) {
          if (side === "front") {
            card.innerHTML = createFrontCardHTML(cardData);
          } else {
            card.innerHTML = createBackCardHTML(cardData);
          }
        }

        // Calculate position for cut lines
        const isLeftColumn = i % 2 === 0;
        const isNotLastRow = i < 6;

        card.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3mm;
          background: ${side === "front" ? "#ffffff" : "#f8f5ff"} !important;
          background-color: ${side === "front" ? "#ffffff" : "#f8f5ff"} !important;
          color: #000000 !important;
          overflow: hidden;
          ${isLeftColumn ? "border-right: 1px dashed #999;" : ""}
          ${isNotLastRow ? "border-bottom: 1px dashed #999;" : ""}
        `;

        page.appendChild(card);
      }

      return page;
    },
    [createFrontCardHTML, createBackCardHTML, reverseRowsForDuplex]
  );

  // Generate PDF
  const handleGeneratePDF = useCallback(async () => {
    setIsGenerating(true);

    try {
      // Dynamically import libraries
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      // Create PDF (A4 size: 210mm x 297mm)
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = 210;
      const pdfHeight = 297;

      // Generate all pages (front and back alternating)
      const allPages: HTMLDivElement[] = [];
      pages.forEach((pageCards) => {
        allPages.push(createPageHTML(pageCards, "front"));
        allPages.push(createPageHTML(pageCards, "back"));
      });

      // Render each page to canvas and add to PDF
      for (let i = 0; i < allPages.length; i++) {
        const pageDiv = allPages[i];

        // Create a wrapper to isolate from page styles (dark mode)
        const wrapper = document.createElement("div");
        wrapper.style.cssText = `
          position: absolute;
          left: -9999px;
          top: 0;
          background: #ffffff !important;
          background-color: #ffffff !important;
          color: #000000 !important;
          color-scheme: light;
        `;
        wrapper.appendChild(pageDiv);
        document.body.appendChild(wrapper);

        // Render to canvas with explicit white background
        const canvas = await html2canvas(pageDiv, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          removeContainer: false,
        });

        // Remove from DOM
        document.body.removeChild(wrapper);

        // Add to PDF
        const imgData = canvas.toDataURL("image/jpeg", 0.98);

        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      }

      // Save PDF
      pdf.save(`flashcards_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("PDF 생성에 실패했습니다.");
    } finally {
      setIsGenerating(false);
    }
  }, [pages, createPageHTML]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
      <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🖨️</span>
            플래시카드 인쇄
            <span className="text-sm font-normal text-gray-500">
              ({words.length}개 선택)
            </span>
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

        {/* Info */}
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            📄 A4 용지 기준, 한 페이지에 <strong>8장</strong>의 카드가
            배치됩니다.
            <br />
            🔄 양면 인쇄 시 <strong>&quot;짧은 면으로 뒤집기&quot;</strong> (위로 넘김)
            설정을 사용하세요.
          </p>
        </div>

        {/* Preview toggle */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setPreviewMode("front")}
            className={clsx(
              "flex-1 py-2.5 text-sm font-semibold transition-all relative",
              previewMode === "front"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            )}
          >
            앞면 미리보기
            {previewMode === "front" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
          <button
            onClick={() => setPreviewMode("back")}
            className={clsx(
              "flex-1 py-2.5 text-sm font-semibold transition-all relative",
              previewMode === "back"
                ? "text-purple-600 dark:text-purple-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            )}
          >
            뒷면 미리보기
            {previewMode === "back" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
            )}
          </button>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-y-auto p-4" ref={printRef}>
          {pages.map((pageCards, pageIndex) => {
            // For back preview, show cards with reversed rows (how they'll print)
            const displayCards = previewMode === "back"
              ? reverseRowsForDuplex(pageCards)
              : pageCards;
            return (
            <div key={pageIndex} className="mb-4">
              <p className="text-xs text-gray-500 mb-2">
                페이지 {pageIndex + 1} / {pages.length}
                {previewMode === "back" && " (뒷면 - 인쇄 순서)"}
              </p>
              <div
                className="grid grid-cols-2 grid-rows-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-xl"
                style={{
                  aspectRatio: "210/297",
                }}
              >
                {displayCards.map((card, cardIndex) => {
                  const isLeftColumn = cardIndex % 2 === 0;
                  const isNotLastRow = cardIndex < 6;
                  return (
                  <div
                    key={cardIndex}
                    className={clsx(
                      "flex flex-col items-center justify-center p-2 text-center",
                      previewMode === "front"
                        ? "bg-white dark:bg-gray-900"
                        : "bg-purple-50 dark:bg-purple-900/30"
                    )}
                    style={{
                      borderRight: isLeftColumn ? "1px dashed #999" : "none",
                      borderBottom: isNotLastRow ? "1px dashed #999" : "none",
                    }}
                  >
                    {card && card.word ? (
                      previewMode === "front" ? (
                        <>
                          <span className="text-lg font-bold text-gray-900 dark:text-white">
                            {card.word.word}
                          </span>
                          <span className="text-[10px] text-gray-500 bg-gray-200 dark:bg-gray-700 px-1.5 rounded mt-1">
                            {card.word.pos}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                            {card.word.reading}
                          </span>
                          <span className="text-xs text-gray-700 dark:text-gray-300">
                            {card.word.meaning}
                          </span>
                          {card.kanjiDetails.length > 0 && (
                            <span className="text-[8px] text-gray-500 mt-0.5">
                              {card.kanjiDetails
                                .filter((k) => k.korean_hun_eum)
                                .map((k) => `${k.literal}:${k.korean_hun_eum}`)
                                .join(" ")}
                            </span>
                          )}
                          {card.word.memo && (
                            <span className="text-[8px] text-gray-400 italic mt-0.5 line-clamp-1">
                              {card.word.memo}
                            </span>
                          )}
                        </>
                      )
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
            );
          })}
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
            disabled={isGenerating}
            className={clsx(
              "flex-1 py-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
              isGenerating
                ? "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg"
            )}
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                생성 중...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
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
