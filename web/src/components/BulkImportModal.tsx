"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import clsx from "clsx";
import { WordFormData, WordPOS, POS_OPTIONS, JlptLevel, JLPT_LEVEL_OPTIONS } from "@/types/word";
import { JLPT_COLORS } from "@/types/kanji";
import { addWords } from "@/services/vocabService";

interface BulkImportModalProps {
  onClose: () => void;
  onImportComplete: () => void;
}

type ApiProvider = "openai" | "anthropic" | "gemini";
type Step = "upload" | "preview" | "complete";

interface ParsedWord {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  pos: WordPOS;
  selected: boolean;
}

// PDF text extraction result type
interface PdfExtractionResult {
  text: string;
  usedOcr: boolean;
}

// PDF text extraction function (tries text layer first, then OCR)
async function extractTextFromPdf(
  file: File,
  onProgress?: (message: string) => void
): Promise<PdfExtractionResult> {
  const report = (msg: string) => {
    console.log(msg);
    onProgress?.(msg);
  };

  report("PDF 라이브러리 로딩 중...");
  const pdfjsLib = await import("pdfjs-dist");

  const version = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  report(`PDF 로드 완료 (${pdf.numPages}페이지)`);

  // First, try to extract text directly
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    report(`텍스트 추출 중... (${i}/${pdf.numPages})`);
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .filter(Boolean)
      .join(" ");
    fullText += pageText + "\n\n";
  }

  fullText = fullText.trim();

  // If text extraction worked, return it
  if (fullText.length > 0) {
    return { text: fullText, usedOcr: false };
  }

  // Text extraction failed - use OCR
  report("텍스트 레이어 없음. OCR 시작...");
  report("일본어 OCR 모델 로딩 중... (최초 실행 시 약 10MB 다운로드)");

  const Tesseract = await import("tesseract.js");

  const worker = await Tesseract.createWorker("jpn", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        report(`OCR 진행 중... ${Math.round((m.progress || 0) * 100)}%`);
      }
    },
  });

  let ocrText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    report(`페이지 ${i}/${pdf.numPages} OCR 처리 중...`);

    const page = await pdf.getPage(i);
    const scale = 2;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    }).promise;

    const imageData = canvas.toDataURL("image/png");
    const { data } = await worker.recognize(imageData);
    ocrText += data.text + "\n\n";
  }

  await worker.terminate();
  report("OCR 완료!");

  return { text: ocrText.trim(), usedOcr: true };
}

// Parse text to extract word + reading pairs
function parseWordList(text: string): { word: string; reading: string }[] {
  const results: { word: string; reading: string }[] = [];

  // Normalize whitespace and split by various delimiters
  const normalizedText = text
    .replace(/\r\n/g, "\n")
    .replace(/\t+/g, " ")
    .replace(/\s{2,}/g, " ");

  // Global pattern to find all word+reading pairs anywhere in text
  // Matches: kanji/mixed word followed by hiragana reading
  // Examples: 実行 じっこう, 47 実行 じっこう (する), 実行じっこう

  // Pattern 1: Number + Kanji + Hiragana (most common in word lists)
  const pattern1 = /(\d+)\s*([々〇〻\u3400-\u9FFF\uF900-\uFAFF]+)\s+([ぁ-んー]+)/g;

  // Pattern 2: Kanji + space + Hiragana (without number)
  const pattern2 = /([々〇〻\u3400-\u9FFF\uF900-\uFAFF][々〇〻\u3400-\u9FFF\uF900-\uFAFFぁ-んァ-ヶー]*)\s+([ぁ-んー]+)/g;

  // Pattern 3: Kanji immediately followed by hiragana in parentheses
  const pattern3 = /([々〇〻\u3400-\u9FFF\uF900-\uFAFF]+)[（(]([ぁ-んー]+)[）)]/g;

  const seen = new Set<string>();

  // Try pattern 1 first (number + kanji + reading)
  let match;
  while ((match = pattern1.exec(normalizedText)) !== null) {
    const word = match[2];
    const reading = match[3];
    const key = `${word}|${reading}`;
    if (word.length >= 1 && reading.length >= 1 && !seen.has(key)) {
      seen.add(key);
      results.push({ word, reading });
    }
  }

  // If pattern 1 found results, return them
  if (results.length > 0) {
    return results;
  }

  // Try pattern 2 (kanji + reading without number)
  while ((match = pattern2.exec(normalizedText)) !== null) {
    const word = match[1];
    const reading = match[2];
    const key = `${word}|${reading}`;
    // Filter out pure hiragana words
    const hasKanji = /[々〇〻\u3400-\u9FFF\uF900-\uFAFF]/.test(word);
    if (hasKanji && word.length >= 1 && reading.length >= 1 && !seen.has(key)) {
      seen.add(key);
      results.push({ word, reading });
    }
  }

  if (results.length > 0) {
    return results;
  }

  // Try pattern 3 (kanji with reading in parentheses)
  while ((match = pattern3.exec(normalizedText)) !== null) {
    const word = match[1];
    const reading = match[2];
    const key = `${word}|${reading}`;
    if (word.length >= 1 && reading.length >= 1 && !seen.has(key)) {
      seen.add(key);
      results.push({ word, reading });
    }
  }

  return results;
}

export function BulkImportModal({ onClose, onImportComplete }: BulkImportModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [apiKey, setApiKey] = useState("");
  const [apiProvider, setApiProvider] = useState<ApiProvider>("gemini");
  const [showApiKey, setShowApiKey] = useState(false);
  const [jlptLevel, setJlptLevel] = useState<JlptLevel | "">("");
  const [source, setSource] = useState("");

  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [extractedText, setExtractedText] = useState("");

  const [isTranslating, setIsTranslating] = useState(false);
  const [parsedWords, setParsedWords] = useState<ParsedWord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved API key
  useEffect(() => {
    const savedKey = localStorage.getItem("jlpt_api_key");
    const savedProvider = localStorage.getItem("jlpt_api_provider") as ApiProvider;
    if (savedKey) setApiKey(savedKey);
    if (savedProvider) setApiProvider(savedProvider);
  }, []);

  // Save API key
  const saveApiKey = useCallback(() => {
    localStorage.setItem("jlpt_api_key", apiKey);
    localStorage.setItem("jlpt_api_provider", apiProvider);
  }, [apiKey, apiProvider]);

  // Handle PDF upload
  const handlePdfUpload = async (file: File) => {
    if (!file.type.includes("pdf")) {
      setError("PDF 파일만 업로드 가능합니다.");
      return;
    }

    setIsPdfLoading(true);
    setPdfProgress("PDF 처리 시작...");
    setError(null);

    try {
      const result = await extractTextFromPdf(file, (progress) => {
        setPdfProgress(progress);
      });

      if (result.text.length === 0) {
        setError("PDF에서 텍스트를 추출할 수 없습니다.");
        return;
      }

      setExtractedText(result.text);

      // Set source from filename if empty
      if (!source) {
        const fileName = file.name.replace(/\.pdf$/i, "");
        setSource(fileName);
      }

      if (result.usedOcr) {
        setPdfProgress("OCR로 텍스트 추출 완료!");
      }
    } catch (err) {
      console.error("PDF extraction error:", err);
      setError(`PDF 처리 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePdfUpload(file);
    e.target.value = "";
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handlePdfUpload(file);
  };

  // Process and translate words
  const handleProcess = async () => {
    if (!extractedText.trim()) {
      setError("텍스트를 입력해주세요.");
      return;
    }
    if (!apiKey.trim()) {
      setError("API 키를 입력해주세요.");
      return;
    }

    saveApiKey();
    setIsTranslating(true);
    setError(null);

    try {
      // Parse word list
      console.log("Parsing text:", extractedText.substring(0, 500));
      const wordList = parseWordList(extractedText);
      console.log("Parsed words:", wordList);

      if (wordList.length === 0) {
        // Show first 200 chars of extracted text for debugging
        const sample = extractedText.substring(0, 200).replace(/\n/g, "↵");
        setError(`단어를 파싱할 수 없습니다.\n\n추출된 텍스트 샘플:\n"${sample}..."\n\n지원 형식:\n• 47 実行 じっこう\n• 実行 じっこう\n• 実行(じっこう)`);
        setIsTranslating(false);
        return;
      }

      // Call translation API
      const response = await fetch("/api/translate-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          words: wordList,
          apiKey: apiKey.trim(),
          apiProvider,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "번역 API 요청 실패");
      }

      // Create parsed words with IDs
      const translated: ParsedWord[] = data.result.map((item: { word: string; reading: string; meaning: string; pos: WordPOS }, index: number) => ({
        id: `word-${index}-${Date.now()}`,
        word: item.word,
        reading: item.reading,
        meaning: item.meaning,
        pos: item.pos || "명사",
        selected: true,
      }));

      setParsedWords(translated);
      setStep("preview");
    } catch (err) {
      console.error("Translation error:", err);
      setError(err instanceof Error ? err.message : "번역 처리 중 오류가 발생했습니다.");
    } finally {
      setIsTranslating(false);
    }
  };

  // Toggle word selection
  const toggleSelect = (id: string) => {
    setParsedWords((prev) =>
      prev.map((w) => (w.id === id ? { ...w, selected: !w.selected } : w))
    );
  };

  // Toggle all selection
  const toggleSelectAll = () => {
    const allSelected = parsedWords.every((w) => w.selected);
    setParsedWords((prev) => prev.map((w) => ({ ...w, selected: !allSelected })));
  };

  // Update word field
  const updateWord = (id: string, field: keyof ParsedWord, value: string) => {
    setParsedWords((prev) =>
      prev.map((w) => (w.id === id ? { ...w, [field]: value } : w))
    );
  };

  // Save selected words
  const handleSave = async () => {
    const selectedWords = parsedWords.filter((w) => w.selected);
    if (selectedWords.length === 0) {
      setError("저장할 단어를 선택해주세요.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const wordDataList: WordFormData[] = selectedWords.map((w) => ({
        word: w.word,
        reading: w.reading,
        meaning: w.meaning,
        pos: w.pos,
        jlpt_level: jlptLevel || null,
        source: source || undefined,
      }));

      await addWords(wordDataList);
      setSavedCount(selectedWords.length);
      setStep("complete");
      onImportComplete();
    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const selectedCount = parsedWords.filter((w) => w.selected).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center modal-backdrop bg-black/60">
      <div
        className={clsx(
          "relative w-full max-w-4xl mx-4 max-h-[95vh] flex flex-col",
          "bg-white dark:bg-gray-900 rounded-2xl",
          "shadow-2xl overflow-hidden"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-500 to-amber-500">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📄</span>
            PDF 단어 일괄 추가
            {step === "preview" && (
              <span className="text-sm font-normal bg-white/20 px-2 py-0.5 rounded">
                {selectedCount}/{parsedWords.length}개 선택
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <>
              {/* API Settings */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  API 설정 (한국어 뜻 번역용)
                </h3>
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs text-gray-500 mb-1">API 제공자</label>
                    <select
                      value={apiProvider}
                      onChange={(e) => setApiProvider(e.target.value as ApiProvider)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="gemini">Google Gemini (무료)</option>
                      <option value="openai">OpenAI (GPT-4o-mini)</option>
                      <option value="anthropic">Anthropic (Claude)</option>
                    </select>
                  </div>
                  <div className="flex-[2] min-w-[250px]">
                    <label className="block text-xs text-gray-500 mb-1">API 키</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={apiProvider === "openai" ? "sk-..." : apiProvider === "anthropic" ? "sk-ant-..." : "Google AI API Key"}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                      >
                        {showApiKey ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Common Settings */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  공통 설정 (모든 단어에 적용)
                </h3>
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-xs text-gray-500 mb-1">JLPT 레벨</label>
                    <select
                      value={jlptLevel}
                      onChange={(e) => setJlptLevel(e.target.value as JlptLevel | "")}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">선택 안함</option>
                      {JLPT_LEVEL_OPTIONS.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-[2] min-w-[200px]">
                    <label className="block text-xs text-gray-500 mb-1">출처</label>
                    <input
                      type="text"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="예: 2024 N2 기출, 교재명"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* PDF Upload Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={clsx(
                  "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all",
                  isDragOver
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {isPdfLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <svg className="animate-spin h-8 w-8 text-orange-600" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm text-gray-600 dark:text-gray-400">{pdfProgress}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <div className="text-sm">
                      <span className="text-orange-600 font-medium">PDF 파일 업로드</span>
                      <span className="text-gray-500 dark:text-gray-400"> 또는 드래그 앤 드롭</span>
                    </div>
                    <span className="text-xs text-gray-400">단어장 PDF에서 단어를 자동 추출합니다</span>
                  </div>
                )}
              </div>

              {/* Text Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    추출된 텍스트 (직접 편집 가능)
                  </label>
                  <span className="text-xs text-gray-400">
                    형식: &quot;번호 한자 읽기&quot; 또는 &quot;한자 읽기&quot;
                  </span>
                </div>
                <textarea
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                  placeholder={`47 実行 じっこう
48 実物 じつぶつ
49 実力 じつりょく
...`}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm resize-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">
                  {error}
                </div>
              )}

              {/* Process Button */}
              <button
                onClick={handleProcess}
                disabled={isTranslating || !extractedText.trim() || !apiKey.trim()}
                className={clsx(
                  "w-full py-3 rounded-xl font-semibold text-white transition-all",
                  isTranslating || !extractedText.trim() || !apiKey.trim()
                    ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                    : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg"
                )}
              >
                {isTranslating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    번역 중...
                  </span>
                ) : (
                  "단어 파싱 및 번역하기"
                )}
              </button>
            </>
          )}

          {/* Step 2: Preview */}
          {step === "preview" && (
            <>
              {/* Common Info Banner */}
              <div className="flex flex-wrap items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                {jlptLevel && (
                  <span
                    className="px-2 py-1 text-xs font-semibold rounded text-white"
                    style={{ backgroundColor: JLPT_COLORS[jlptLevel] }}
                  >
                    {jlptLevel}
                  </span>
                )}
                {source && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    📖 {source}
                  </span>
                )}
              </div>

              {/* Select All */}
              <div className="flex items-center justify-between">
                <button
                  onClick={toggleSelectAll}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {parsedWords.every((w) => w.selected) ? "전체 선택 해제" : "전체 선택"}
                </button>
                <span className="text-sm text-gray-500">
                  {selectedCount}개 선택됨
                </span>
              </div>

              {/* Word Table */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="w-10 px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={parsedWords.every((w) => w.selected)}
                          onChange={toggleSelectAll}
                          className="rounded"
                        />
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">단어</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">읽기</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">뜻</th>
                      <th className="w-24 px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">품사</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {parsedWords.map((word) => (
                      <tr
                        key={word.id}
                        className={clsx(
                          "transition-colors",
                          word.selected
                            ? "bg-white dark:bg-gray-900"
                            : "bg-gray-100 dark:bg-gray-800 opacity-60"
                        )}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={word.selected}
                            onChange={() => toggleSelect(word.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={word.word}
                            onChange={(e) => updateWord(word.id, "word", e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-transparent text-gray-900 dark:text-white font-bold"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={word.reading}
                            onChange={(e) => updateWord(word.id, "reading", e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-transparent text-blue-600 dark:text-blue-400"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={word.meaning}
                            onChange={(e) => updateWord(word.id, "meaning", e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-transparent text-gray-700 dark:text-gray-300"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={word.pos}
                            onChange={(e) => updateWord(word.id, "pos", e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-transparent text-gray-700 dark:text-gray-300 text-xs"
                          >
                            {POS_OPTIONS.map((pos) => (
                              <option key={pos} value={pos}>{pos}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("upload")}
                  className="flex-1 py-3 rounded-xl font-semibold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  ← 이전 단계
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || selectedCount === 0}
                  className={clsx(
                    "flex-[2] py-3 rounded-xl font-semibold text-white transition-all",
                    isSaving || selectedCount === 0
                      ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                      : "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg"
                  )}
                >
                  {isSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      저장 중...
                    </span>
                  ) : (
                    `선택한 ${selectedCount}개 단어 저장`
                  )}
                </button>
              </div>
            </>
          )}

          {/* Step 3: Complete */}
          {step === "complete" && (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                저장 완료!
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {savedCount}개의 단어가 나만의 단어장에 추가되었습니다.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => {
                    setStep("upload");
                    setExtractedText("");
                    setParsedWords([]);
                    setSavedCount(0);
                  }}
                  className="px-6 py-2.5 rounded-xl font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  추가로 가져오기
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                >
                  완료
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
