"use client";

interface HeaderProps {
  totalCount: number;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenFlashcard: () => void;
  onOpenWordFlashcard: () => void;
  onOpenMyVocab: () => void;
}

export function Header({ totalCount, isDarkMode, onToggleDarkMode, onOpenFlashcard, onOpenWordFlashcard, onOpenMyVocab }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            <span className="text-blue-600 dark:text-blue-400">漢字</span>
            マスター
          </h1>
          <span className="hidden sm:inline-block px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full">
            常用漢字 {totalCount.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* 나만의 단어장 버튼 */}
          <button
            onClick={onOpenMyVocab}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
            style={{
              background: "linear-gradient(to right, #f59e0b, #f97316)",
              color: "#ffffff",
            }}
          >
            <span>📚</span>
            <span className="hidden sm:inline">내 단어장</span>
          </button>

          {/* 단어 암기장 버튼 */}
          <button
            onClick={onOpenWordFlashcard}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
            style={{
              background: "linear-gradient(to right, #059669, #0d9488)",
              color: "#ffffff",
            }}
          >
            <span>📖</span>
            <span className="hidden sm:inline">단어 암기장</span>
          </button>

          {/* 플래시카드 버튼 */}
          <button
            onClick={onOpenFlashcard}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
            style={{
              background: "linear-gradient(to right, #2563eb, #4f46e5)",
              color: "#ffffff",
            }}
          >
            <span>🎴</span>
            <span className="hidden sm:inline">플래시카드</span>
          </button>

          {/* 다크 모드 토글 */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? (
              <svg
                className="w-5 h-5 text-yellow-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-gray-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>

          {/* GitHub 링크 */}
          <a
            href="https://github.com/KJS0619/kanji-db-builder"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="GitHub"
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-300"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
