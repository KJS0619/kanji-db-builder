"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";

interface JlptExplainerModalProps {
  onClose: () => void;
}

type ApiProvider = "openai" | "anthropic" | "gemini";

const EXAMPLE_INPUT = `[1번 문항]
- 본문: 初めて作る料理はレシピがなければ ( )。
- 보기: ① 作らずにはいられない ② 作りようがない ③ 作るわけじゃない ④ 作りたくてしかたがない
- 정답: ②

[2번 문항]
- 본문: 全ての野菜が嫌いな ( ) ですが、苦手なものが多いのであまり食べません。
- 보기: ① わけではない ② もの ③ はずがない ④ まま
- 정답: ①`;

export function JlptExplainerModal({ onClose }: JlptExplainerModalProps) {
  const [questions, setQuestions] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiProvider, setApiProvider] = useState<ApiProvider>("gemini");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Load saved API key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem("jlpt_api_key");
    const savedProvider = localStorage.getItem("jlpt_api_provider") as ApiProvider;
    if (savedKey) setApiKey(savedKey);
    if (savedProvider) setApiProvider(savedProvider);
  }, []);

  // Save API key to localStorage
  const saveApiKey = useCallback(() => {
    localStorage.setItem("jlpt_api_key", apiKey);
    localStorage.setItem("jlpt_api_provider", apiProvider);
  }, [apiKey, apiProvider]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
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
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!result ? (
            <>
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
                  rows={12}
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
                  "🚀 해설 생성하기"
                )}
              </button>
            </>
          ) : (
            <>
              {/* Result Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  생성된 해설
                </h3>
                <div className="flex gap-2">
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
                    onClick={() => setResult(null)}
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
              <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-gray-50 dark:bg-gray-800 rounded-xl overflow-x-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result}
                </ReactMarkdown>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
