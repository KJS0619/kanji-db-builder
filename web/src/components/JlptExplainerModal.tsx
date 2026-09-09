"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import {
  JlptExplanation,
  fetchExplanations,
  addExplanation,
  deleteExplanation,
} from "@/services/jlptExplanationService";

interface JlptExplainerModalProps {
  onClose: () => void;
}

type ApiProvider = "openai" | "anthropic" | "gemini";
type ViewMode = "input" | "result" | "saved";

const EXAMPLE_INPUT = `[1번 문항]
- 본문: 初めて作る料理はレシピがなければ ( )。
- 보기: ① 作らずにはいられない ② 作りようがない ③ 作るわけじゃない ④ 作りたくてしかたがない
- 정답: ②

[2번 문항]
- 본문: 全ての野菜が嫌いな ( ) ですが、苦手なものが多いのであまり食べません。
- 보기: ① わけではない ② もの ③ はずがない ④ まま
- 정답: ①`;

// PDF text extraction function
async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  // Set worker source for pdfjs-dist v4+
  // Using unpkg CDN which is more reliable
  const version = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .filter(Boolean)
      .join(" ");
    fullText += pageText + "\n\n";
  }

  return fullText.trim();
}

export function JlptExplainerModal({ onClose }: JlptExplainerModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("input");
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiProvider, setApiProvider] = useState<ApiProvider>("gemini");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [savedExplanations, setSavedExplanations] = useState<JlptExplanation[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedExplanation, setSelectedExplanation] = useState<JlptExplanation | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved API key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem("jlpt_api_key");
    const savedProvider = localStorage.getItem("jlpt_api_provider") as ApiProvider;
    if (savedKey) setApiKey(savedKey);
    if (savedProvider) setApiProvider(savedProvider);
  }, []);

  // Load saved explanations
  useEffect(() => {
    loadSavedExplanations();
  }, []);

  const loadSavedExplanations = async () => {
    try {
      const data = await fetchExplanations();
      setSavedExplanations(data);
    } catch (err) {
      console.error("Failed to load explanations:", err);
    }
  };

  // Save API key to localStorage
  const saveApiKey = useCallback(() => {
    localStorage.setItem("jlpt_api_key", apiKey);
    localStorage.setItem("jlpt_api_provider", apiProvider);
  }, [apiKey, apiProvider]);

  // Handle PDF file upload
  const handlePdfUpload = async (file: File) => {
    if (!file.type.includes("pdf")) {
      setError("PDF 파일만 업로드 가능합니다.");
      return;
    }

    setIsPdfLoading(true);
    setError(null);

    try {
      const text = await extractTextFromPdf(file);
      setQuestions(text);

      // Set title from filename if empty
      if (!title) {
        const fileName = file.name.replace(/\.pdf$/i, "");
        setTitle(fileName);
      }
    } catch (err) {
      console.error("PDF extraction error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`PDF 텍스트 추출 실패: ${errorMessage}`);
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePdfUpload(file);
    }
    // Reset input so same file can be selected again
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
    if (file) {
      handlePdfUpload(file);
    }
  };

  // Generate explanation
  const handleGenerate = async () => {
    if (!questions.trim()) {
      setError("문제 데이터를 입력해주세요.");
      return;
    }
    if (!apiKey.trim()) {
      setError("API 키를 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    saveApiKey();

    try {
      const response = await fetch("/api/jlpt-explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questions: questions.trim(),
          apiKey: apiKey.trim(),
          apiProvider,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "해설 생성에 실패했습니다.");
      }

      setResult(data.result);
      setViewMode("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // Save explanation to Supabase
  const handleSave = async () => {
    if (!result) return;

    const saveTitle = title.trim() || `JLPT 해설 ${new Date().toLocaleDateString("ko-KR")}`;

    setIsSaving(true);
    try {
      await addExplanation({
        title: saveTitle,
        questions: questions,
        explanation: result,
      });
      alert("저장되었습니다.");
      await loadSavedExplanations();
    } catch (err) {
      alert(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete saved explanation
  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      await deleteExplanation(id);
      await loadSavedExplanations();
      if (selectedExplanation?.id === id) {
        setSelectedExplanation(null);
        setViewMode("saved");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    }
  };

  // View saved explanation
  const handleViewSaved = (explanation: JlptExplanation) => {
    setSelectedExplanation(explanation);
    setTitle(explanation.title);
    setQuestions(explanation.questions);
    setResult(explanation.explanation);
    setViewMode("result");
  };

  // Load example
  const loadExample = () => {
    setQuestions(EXAMPLE_INPUT);
  };

  // Copy result to clipboard
  const copyResult = async () => {
    if (result) {
      await navigator.clipboard.writeText(result);
      alert("클립보드에 복사되었습니다.");
    }
  };

  // Print to A4
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("팝업이 차단되었습니다. 팝업을 허용해주세요.");
      return;
    }

    const printTitle = title || selectedExplanation?.title || "JLPT 해설";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${printTitle}</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Noto Sans JP', 'Noto Sans KR', sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            max-width: 100%;
          }
          h1 {
            font-size: 18pt;
            border-bottom: 2px solid #333;
            padding-bottom: 8px;
            margin-bottom: 20px;
          }
          h2 {
            font-size: 14pt;
            margin-top: 24px;
            margin-bottom: 12px;
            color: #444;
          }
          h3 {
            font-size: 12pt;
            margin-top: 16px;
            margin-bottom: 8px;
          }
          p {
            margin: 8px 0;
          }
          ul, ol {
            margin: 8px 0;
            padding-left: 24px;
          }
          li {
            margin: 4px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
          }
          th, td {
            border: 1px solid #ccc;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f5f5f5;
          }
          code {
            background-color: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10pt;
          }
          pre {
            background-color: #f5f5f5;
            padding: 12px;
            border-radius: 4px;
            overflow-x: auto;
          }
          hr {
            border: none;
            border-top: 1px solid #ddd;
            margin: 20px 0;
          }
          .questions-section {
            background-color: #f9f9f9;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 24px;
          }
          .questions-section h2 {
            margin-top: 0;
          }
          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <h1>${printTitle}</h1>
        <div class="questions-section">
          <h2>문제</h2>
          <pre style="white-space: pre-wrap; font-family: inherit;">${questions}</pre>
        </div>
        <h2>해설</h2>
        ${printContent.innerHTML}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  // Reset to new input
  const handleNewQuestion = () => {
    setTitle("");
    setQuestions("");
    setResult(null);
    setSelectedExplanation(null);
    setViewMode("input");
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/60">
      <div
        className={clsx(
          "relative w-full max-w-4xl mx-4 max-h-[95vh] flex flex-col",
          "bg-white dark:bg-gray-900 rounded-2xl",
          "shadow-2xl overflow-hidden"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-600 to-indigo-600">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📝</span>
            JLPT 문법 해설 생성기
          </h2>
          <div className="flex items-center gap-2">
            {/* Tab Buttons */}
            <button
              onClick={() => setViewMode("input")}
              className={clsx(
                "px-3 py-1 rounded-lg text-sm font-medium transition-colors",
                viewMode === "input"
                  ? "bg-white text-purple-600"
                  : "text-white/80 hover:bg-white/20"
              )}
            >
              새 문제
            </button>
            <button
              onClick={() => setViewMode("saved")}
              className={clsx(
                "px-3 py-1 rounded-lg text-sm font-medium transition-colors",
                viewMode === "saved"
                  ? "bg-white text-purple-600"
                  : "text-white/80 hover:bg-white/20"
              )}
            >
              저장된 해설 ({savedExplanations.length})
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 transition-colors ml-2"
            >
              <svg
                className="w-5 h-5 text-white"
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {viewMode === "input" && (
            <>
              {/* Title Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  제목 (선택)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: JLPT N2 문법 1회차"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>

              {/* API Settings */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  API 설정
                </h3>
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs text-gray-500 mb-1">API 제공자</label>
                    <select
                      value={apiProvider}
                      onChange={(e) => setApiProvider(e.target.value as ApiProvider)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="gemini">Google Gemini (무료)</option>
                      <option value="openai">OpenAI (GPT-4o)</option>
                      <option value="anthropic">Anthropic (Claude)</option>
                    </select>
                  </div>
                  <div className="flex-[2] min-w-[300px]">
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
                    <p className="mt-1 text-xs text-gray-400">
                      API 키는 브라우저에 저장되며 서버로 전송됩니다.
                    </p>
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
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-gray-50 dark:hover:bg-gray-800"
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
                    <svg className="animate-spin h-8 w-8 text-purple-600" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm text-gray-600 dark:text-gray-400">PDF 텍스트 추출 중...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v6a1 1 0 001 1h6" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-6 4h6" />
                    </svg>
                    <div className="text-sm">
                      <span className="text-purple-600 font-medium">PDF 파일 업로드</span>
                      <span className="text-gray-500 dark:text-gray-400"> 또는 드래그 앤 드롭</span>
                    </div>
                    <span className="text-xs text-gray-400">JLPT 문제지 PDF에서 텍스트를 자동 추출합니다</span>
                  </div>
                )}
              </div>

              {/* Question Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    문제 데이터 입력
                  </label>
                  <button
                    onClick={loadExample}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    예시 불러오기
                  </button>
                </div>
                <textarea
                  value={questions}
                  onChange={(e) => setQuestions(e.target.value)}
                  placeholder={`[1번 문항]
- 본문: 문장...
- 보기: ① ... ② ... ③ ... ④ ...
- 정답: ①

[2번 문항]
...`}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm resize-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isLoading || !questions.trim() || !apiKey.trim()}
                className={clsx(
                  "w-full py-3 rounded-xl font-semibold text-white transition-all",
                  isLoading || !questions.trim() || !apiKey.trim()
                    ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg"
                )}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    해설 생성 중... (30초~1분 소요)
                  </span>
                ) : (
                  "해설 생성하기"
                )}
              </button>
            </>
          )}

          {viewMode === "result" && result && (
            <>
              {/* Result Header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {title || selectedExplanation?.title || "생성된 해설"}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    A4 출력
                  </button>
                  {!selectedExplanation && (
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      {isSaving ? "저장 중..." : "저장"}
                    </button>
                  )}
                  <button
                    onClick={copyResult}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    복사
                  </button>
                  <button
                    onClick={handleNewQuestion}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    새 문제
                  </button>
                </div>
              </div>

              {/* Markdown Result */}
              <div
                ref={printRef}
                className="prose prose-sm dark:prose-invert max-w-none p-4 bg-gray-50 dark:bg-gray-800 rounded-xl overflow-x-auto"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result}
                </ReactMarkdown>
              </div>
            </>
          )}

          {viewMode === "saved" && (
            <>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                저장된 해설 목록
              </h3>
              {savedExplanations.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>저장된 해설이 없습니다.</p>
                  <button
                    onClick={() => setViewMode("input")}
                    className="mt-4 text-purple-600 hover:underline"
                  >
                    새 해설 생성하기
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedExplanations.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => handleViewSaved(item)}
                      >
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {item.title}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {new Date(item.created_at).toLocaleString("ko-KR")}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewSaved(item)}
                          className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
