"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import clsx from "clsx";

/**
 * 범용 플래시카드 인쇄 인터페이스
 * 어떤 플래시카드 모달에서든 이 인터페이스를 구현하여 인쇄 기능 사용 가능
 */
export interface PrintableCard {
  id: string;
  /** 앞면에 표시할 내용 */
  frontContent: {
    main: string;      // 주요 텍스트 (한자, 단어 등)
    mainKr?: string;   // 한국어 폰트로 표시할 한자 (한·일 대조용)
    mainJp?: string;   // 일본어 폰트로 표시할 한자 (한·일 대조용)
    sub?: string;      // 부가 정보 (품사, 훈음 등)
  };
  /** 뒷면에 표시할 내용 */
  backContent: {
    primary: string;   // 첫 번째 줄 (읽기, 음독 등)
    primaryLang?: "ko" | "ja"; // primary 텍스트 언어 (폰트 분리용)
    secondary?: string; // 두 번째 줄 (뜻, 의미 등)
    secondaryLang?: "ko" | "ja"; // secondary 텍스트 언어
    tertiary?: string;  // 세 번째 줄 (추가 정보)
    extra?: string;     // 네 번째 줄 (메모 등)
  };
}

export interface GenericFlashcardPrintModalProps {
  title: string;
  cards: PrintableCard[];
  onClose: () => void;
  /** 카드 앞면 스타일 커스터마이징 */
  frontStyles?: {
    mainFontSize?: string;
    subFontSize?: string;
    mainColor?: string;
  };
  /** 카드 뒷면 스타일 커스터마이징 */
  backStyles?: {
    primaryFontSize?: string;
    secondaryFontSize?: string;
    primaryColor?: string;
  };
}

const CARDS_PER_PAGE = 12;

export function GenericFlashcardPrintModal({
  title,
  cards,
  onClose,
  frontStyles = {},
  backStyles = {},
}: GenericFlashcardPrintModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewMode, setPreviewMode] = useState<"front" | "back">("front");
  const printRef = useRef<HTMLDivElement>(null);

  // Default styles
  const {
    mainFontSize = "32pt",
    subFontSize = "11pt",
    mainColor = "#000000",
  } = frontStyles;

  const {
    primaryFontSize = "20pt",
    secondaryFontSize = "16pt",
    primaryColor = "#000000",
  } = backStyles;

  // Pad to multiple of 12
  const paddedCards: (PrintableCard | null)[] = useMemo(() => {
    const data = [...cards];
    const remainder = data.length % CARDS_PER_PAGE;
    if (remainder !== 0) {
      const paddingCount = CARDS_PER_PAGE - remainder;
      for (let i = 0; i < paddingCount; i++) {
        data.push(null as unknown as PrintableCard);
      }
    }
    return data;
  }, [cards]);

  // Split into pages (12 cards per page)
  const pages = useMemo(() => {
    const result: (PrintableCard | null)[][] = [];
    for (let i = 0; i < paddedCards.length; i += CARDS_PER_PAGE) {
      result.push(paddedCards.slice(i, i + CARDS_PER_PAGE));
    }
    return result;
  }, [paddedCards]);

  // Reverse rows for "flip on short edge" duplex printing
  const reverseRowsForDuplex = useCallback(
    (pageCards: (PrintableCard | null)[]): (PrintableCard | null)[] => {
      const result: (PrintableCard | null)[] = [];
      for (let row = 3; row >= 0; row--) {
        result.push(pageCards[row * 3] || null);
        result.push(pageCards[row * 3 + 1] || null);
        result.push(pageCards[row * 3 + 2] || null);
      }
      return result;
    },
    []
  );

  // 폰트 스타일 상수
  const FONT_KR = "'Noto Serif KR', 'Noto Sans KR', 'Malgun Gothic', serif";
  const FONT_JP = "'Noto Sans JP', 'Noto Serif JP', 'Hiragino Kaku Gothic ProN', sans-serif";
  const FONT_DEFAULT = "'Noto Sans JP', 'Arial Black', sans-serif";

  // Create front card HTML
  const createFrontCardHTML = useCallback(
    (card: PrintableCard): string => {
      // 한·일 대조 모드 (mainKr, mainJp 둘 다 있는 경우)
      if (card.frontContent.mainKr && card.frontContent.mainJp) {
        const subHtml = card.frontContent.sub
          ? `<div style="font-size: ${subFontSize}; font-weight: 900 !important; color: ${mainColor} !important; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; line-height: 1.3;">${card.frontContent.sub}</div>`
          : "";

        return `<div style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;"><div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px;"><span style="font-size: ${mainFontSize}; font-weight: 900 !important; color: #2563eb !important; font-family: ${FONT_KR}; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision;">${card.frontContent.mainKr}</span><span style="font-size: 20pt; color: #666;">→</span><span style="font-size: ${mainFontSize}; font-weight: 900 !important; color: #dc2626 !important; font-family: ${FONT_JP}; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision;">${card.frontContent.mainJp}</span></div>${subHtml}</div>`;
      }

      // 일반 모드
      const subHtml = card.frontContent.sub
        ? `<div style="font-size: ${subFontSize}; font-weight: 900 !important; color: ${mainColor} !important; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; line-height: 1.3;">${card.frontContent.sub}</div>`
        : "";

      return `<div style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;"><div style="font-size: ${mainFontSize}; font-weight: 900 !important; color: ${mainColor} !important; margin-bottom: 8px; font-family: ${FONT_DEFAULT}; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision;">${card.frontContent.main}</div>${subHtml}</div>`;
    },
    [mainFontSize, subFontSize, mainColor]
  );

  // Create back card HTML
  const createBackCardHTML = useCallback(
    (card: PrintableCard): string => {
      // 언어별 폰트 선택
      const getPrimaryFont = () => {
        if (card.backContent.primaryLang === "ko") return FONT_KR;
        if (card.backContent.primaryLang === "ja") return FONT_JP;
        return FONT_JP; // 기본값
      };
      const getSecondaryFont = () => {
        if (card.backContent.secondaryLang === "ko") return FONT_KR;
        if (card.backContent.secondaryLang === "ja") return FONT_JP;
        return FONT_DEFAULT;
      };

      // HTML 템플릿 - 불필요한 공백 제거로 레이아웃 안정화
      const primaryHtml = `<div style="font-size: ${primaryFontSize}; color: ${primaryColor} !important; font-weight: 900 !important; margin-bottom: 6px; font-family: ${getPrimaryFont()}; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; line-height: 1.3;">${card.backContent.primary}</div>`;

      const secondaryHtml = card.backContent.secondary
        ? `<div style="font-size: ${secondaryFontSize}; color: ${primaryColor} !important; font-weight: 900 !important; margin-bottom: 8px; font-family: ${getSecondaryFont()}; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; line-height: 1.3;">${card.backContent.secondary}</div>`
        : "";

      const tertiaryHtml = card.backContent.tertiary
        ? `<div style="font-size: 11pt; color: ${primaryColor} !important; font-weight: 900 !important; margin-bottom: 4px; padding: 0 4px; font-family: 'Noto Sans JP', sans-serif; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; line-height: 1.3;">${card.backContent.tertiary}</div>`
        : "";

      const extraHtml = card.backContent.extra
        ? `<div style="font-size: 11pt; color: ${primaryColor} !important; font-weight: 900 !important; border-top: 2px solid #000 !important; padding-top: 6px; margin-top: 6px; font-family: sans-serif; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; line-height: 1.3;">${card.backContent.extra}</div>`
        : "";

      return `<div style="text-align: center; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">${primaryHtml}${secondaryHtml}${tertiaryHtml}${extraHtml}</div>`;
    },
    [primaryFontSize, secondaryFontSize, primaryColor]
  );

  // Create page HTML element
  const createPageHTML = useCallback(
    (
      pageCards: (PrintableCard | null)[],
      side: "front" | "back"
    ): HTMLDivElement => {
      const page = document.createElement("div");
      page.style.cssText = `
        width: 210mm;
        height: 297mm;
        padding: 10mm;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        grid-template-rows: repeat(4, 1fr);
        gap: 0;
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #000000 !important;
      `;

      const orderedCards =
        side === "back" ? reverseRowsForDuplex(pageCards) : pageCards;

      for (let i = 0; i < CARDS_PER_PAGE; i++) {
        const cardData = orderedCards[i];
        const card = document.createElement("div");

        if (cardData) {
          if (side === "front") {
            card.innerHTML = createFrontCardHTML(cardData);
          } else {
            card.innerHTML = createBackCardHTML(cardData);
          }
        }

        const isNotRightColumn = i % 3 !== 2;
        const isNotLastRow = i < 9;

        card.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3mm;
          background: #ffffff !important;
          background-color: #ffffff !important;
          color: #000000 !important;
          overflow: visible;
          filter: none !important;
          -webkit-filter: none !important;
          box-sizing: border-box;
          ${isNotRightColumn ? "border-right: 1px dashed #999;" : ""}
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
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = 210;
      const pdfHeight = 297;

      const allPages: HTMLDivElement[] = [];
      pages.forEach((pageCards) => {
        allPages.push(createPageHTML(pageCards, "front"));
        allPages.push(createPageHTML(pageCards, "back"));
      });

      for (let i = 0; i < allPages.length; i++) {
        const pageDiv = allPages[i];

        const wrapper = document.createElement("div");
        wrapper.style.cssText = `
          position: absolute;
          left: -9999px;
          top: 0;
          background: #ffffff !important;
          background-color: #ffffff !important;
          color: #000000 !important;
          color-scheme: light;
          filter: none !important;
        `;
        pageDiv.style.setProperty("filter", "none", "important");
        pageDiv.style.setProperty("color", "#000000", "important");
        pageDiv.style.setProperty("background", "#ffffff", "important");

        wrapper.appendChild(pageDiv);
        document.body.appendChild(wrapper);

        const canvas = await html2canvas(pageDiv, {
          scale: 3,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          removeContainer: false,
        });

        document.body.removeChild(wrapper);

        const imgData = canvas.toDataURL("image/png");

        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      }

      const safeTitle = title.replace(/[^a-zA-Z0-9가-힣]/g, "_");
      pdf.save(`${safeTitle}_${new Date().toISOString().slice(0, 10)}.pdf`);
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
            <span>🖨️</span>
            {title} 인쇄
            <span className="text-sm font-normal text-gray-500">
              ({cards.length}개 선택 → {paddedCards.length}장 / {pages.length}
              페이지)
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
            📄 A4 용지 기준, 한 페이지에 <strong>12장</strong>의 카드가
            배치됩니다 (3열 × 4행).
            <br />
            📦 전체 카드는 12의 배수로 패딩됩니다 (12, 24, 36, 48...).
            <br />
            🔄 양면 인쇄 시 <strong>&quot;짧은 면으로 뒤집기&quot;</strong> (위로
            넘김) 설정을 사용하세요.
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
            const displayCards =
              previewMode === "back"
                ? reverseRowsForDuplex(pageCards)
                : pageCards;
            return (
              <div key={pageIndex} className="mb-4">
                <p className="text-xs text-gray-500 mb-2">
                  페이지 {pageIndex + 1} / {pages.length}
                  {previewMode === "back" && " (뒷면 - 인쇄 순서)"}
                </p>
                <div
                  className="grid grid-cols-3 grid-rows-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-xl"
                  style={{
                    aspectRatio: "210/297",
                  }}
                >
                  {displayCards.map((card, cardIndex) => {
                    const isNotRightColumn = cardIndex % 3 !== 2;
                    const isNotLastRow = cardIndex < 9;
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
                          borderRight: isNotRightColumn
                            ? "1px dashed #999"
                            : "none",
                          borderBottom: isNotLastRow
                            ? "1px dashed #999"
                            : "none",
                        }}
                      >
                        {card ? (
                          previewMode === "front" ? (
                            <>
                              {/* 한·일 대조 모드 */}
                              {card.frontContent.mainKr && card.frontContent.mainJp ? (
                                <div className="flex items-center gap-1">
                                  <span lang="ko" className="text-base font-bold text-blue-600 kanji-kr">
                                    {card.frontContent.mainKr}
                                  </span>
                                  <span className="text-gray-400 text-xs">→</span>
                                  <span lang="ja" className="text-base font-bold text-red-600 kanji-jp">
                                    {card.frontContent.mainJp}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-lg font-bold text-gray-900 dark:text-white">
                                  {card.frontContent.main}
                                </span>
                              )}
                              {card.frontContent.sub && (
                                <span className="text-[10px] text-gray-500 bg-gray-200 dark:bg-gray-700 px-1.5 rounded mt-1">
                                  {card.frontContent.sub}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <span
                                lang={card.backContent.primaryLang || undefined}
                                className={clsx(
                                  "text-sm font-bold text-purple-600 dark:text-purple-400",
                                  card.backContent.primaryLang === "ja" && "font-ja",
                                  card.backContent.primaryLang === "ko" && "font-ko"
                                )}
                              >
                                {card.backContent.primary}
                              </span>
                              {card.backContent.secondary && (
                                <span
                                  lang={card.backContent.secondaryLang || undefined}
                                  className={clsx(
                                    "text-xs text-gray-700 dark:text-gray-300",
                                    card.backContent.secondaryLang === "ja" && "font-ja",
                                    card.backContent.secondaryLang === "ko" && "font-ko"
                                  )}
                                >
                                  {card.backContent.secondary}
                                </span>
                              )}
                              {card.backContent.tertiary && (
                                <span className="text-[8px] text-gray-500 mt-0.5">
                                  {card.backContent.tertiary}
                                </span>
                              )}
                              {card.backContent.extra && (
                                <span className="text-[8px] text-gray-400 italic mt-0.5 line-clamp-1">
                                  {card.backContent.extra}
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

/**
 * 유틸리티: 카드 데이터를 PrintableCard로 변환하는 헬퍼 함수들
 */

// 한자 (Kanji) → PrintableCard
export function kanjiToPrintableCard(kanji: {
  literal: string;
  onyomi?: string[];
  kunyomi?: string[];
  korean_hun_eum?: string;
  meanings?: string[];
}): PrintableCard {
  return {
    id: kanji.literal,
    frontContent: {
      main: kanji.literal,
      sub: kanji.korean_hun_eum || "",
    },
    backContent: {
      primary: kanji.onyomi?.join(", ") || "-",
      secondary: kanji.kunyomi?.join(", ") || "-",
      tertiary: kanji.meanings?.slice(0, 3).join(", ") || "",
    },
  };
}

// 국자 (Kokuji) → PrintableCard
export function kokujiToPrintableCard(kokuji: {
  kanji: string;
  reading: string;
  koreanHunEum: string;
  meaning: string;
  exampleWord?: string;
  exampleReading?: string;
}): PrintableCard {
  return {
    id: kokuji.kanji,
    frontContent: {
      main: kokuji.kanji,
      sub: kokuji.koreanHunEum,
    },
    backContent: {
      primary: kokuji.reading,
      secondary: kokuji.meaning,
      tertiary: kokuji.exampleWord
        ? `${kokuji.exampleWord} (${kokuji.exampleReading})`
        : undefined,
    },
  };
}

// 한일 차이 한자 → PrintableCard
export function kanjiDiffToPrintableCard(diff: {
  kanji: string;
  koreanHunEum: string;
  japaneseOn: string;
  japaneseKun: string;
  koreanWord?: string;
  japaneseWord?: string;
}): PrintableCard {
  return {
    id: diff.kanji,
    frontContent: {
      main: diff.kanji,
      sub: diff.koreanHunEum,
    },
    backContent: {
      primary: `음: ${diff.japaneseOn}`,
      secondary: `훈: ${diff.japaneseKun}`,
      tertiary:
        diff.koreanWord && diff.japaneseWord
          ? `${diff.koreanWord} → ${diff.japaneseWord}`
          : undefined,
    },
  };
}
