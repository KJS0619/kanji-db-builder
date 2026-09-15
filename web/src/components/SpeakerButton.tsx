"use client";

import { useCallback } from "react";
import clsx from "clsx";

interface SpeakerButtonProps {
  text: string;
  onSpeak: (text: string) => void;
  isSpeaking?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
}

/**
 * TTS 발음 재생 버튼 컴포넌트
 * 클릭 시 해당 텍스트를 일본어로 발음
 */
export function SpeakerButton({
  text,
  onSpeak,
  isSpeaking = false,
  size = "sm",
  className,
  title = "발음 듣기",
}: SpeakerButtonProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
      e.preventDefault();
      onSpeak(text);
    },
    [text, onSpeak]
  );

  const sizeClasses = {
    sm: "w-6 h-6 text-sm",
    md: "w-8 h-8 text-base",
    lg: "w-10 h-10 text-lg",
  };

  const iconSizeClasses = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      className={clsx(
        "inline-flex items-center justify-center rounded-full transition-all",
        "hover:bg-blue-100 dark:hover:bg-blue-900/50",
        "focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1",
        sizeClasses[size],
        isSpeaking && "animate-pulse bg-blue-100 dark:bg-blue-900/50 text-blue-600",
        !isSpeaking && "text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400",
        className
      )}
    >
      {isSpeaking ? (
        // 재생 중 아이콘 (음파 애니메이션)
        <svg
          className={clsx(iconSizeClasses[size], "animate-pulse")}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
        </svg>
      ) : (
        // 기본 스피커 아이콘
        <svg
          className={iconSizeClasses[size]}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
        </svg>
      )}
    </button>
  );
}

/**
 * TTS 자동재생 토글 스위치 컴포넌트
 */
interface TTSToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  isSupported?: boolean;
}

export function TTSAutoPlayToggle({ enabled, onChange, isSupported = true }: TTSToggleProps) {
  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span>🔇</span>
        <span>TTS 미지원 브라우저</span>
      </div>
    );
  }

  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <span className="text-sm text-gray-600 dark:text-gray-300">
        🔊 자동 발음
      </span>
      <div className="relative">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div
          className={clsx(
            "w-10 h-5 rounded-full transition-colors",
            "peer-focus:ring-2 peer-focus:ring-blue-400 peer-focus:ring-offset-1",
            enabled
              ? "bg-blue-500"
              : "bg-gray-300 dark:bg-gray-600"
          )}
        />
        <div
          className={clsx(
            "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
            enabled && "translate-x-5"
          )}
        />
      </div>
    </label>
  );
}
