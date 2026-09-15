"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface TTSOptions {
  rate?: number;
  pitch?: number;
  lang?: string;
}

interface UseKanjiTTSReturn {
  speak: (text: string, options?: TTSOptions) => void;
  speakSequence: (texts: string[], options?: TTSOptions) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  japaneseVoice: SpeechSynthesisVoice | null;
}

const DEFAULT_OPTIONS: TTSOptions = {
  rate: 0.9,
  pitch: 1.0,
  lang: "ja-JP",
};

/**
 * 일본어 TTS를 위한 커스텀 훅
 * Web Speech API를 활용한 일본어 음성 합성
 */
export function useKanjiTTS(): UseKanjiTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [japaneseVoice, setJapaneseVoice] = useState<SpeechSynthesisVoice | null>(null);
  const sequenceRef = useRef<string[]>([]);
  const sequenceIndexRef = useRef(0);
  const isPlayingSequenceRef = useRef(false);

  // 브라우저 지원 여부 및 일본어 음성 탐색
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const findJapaneseVoice = () => {
      const voices = window.speechSynthesis.getVoices();

      // 일본어 음성 우선순위:
      // 1. ja-JP 정확히 매칭
      // 2. ja로 시작하는 음성
      // 3. 이름에 Japanese/Japan 포함
      const jaVoice =
        voices.find((v) => v.lang === "ja-JP") ||
        voices.find((v) => v.lang.startsWith("ja")) ||
        voices.find((v) => v.name.toLowerCase().includes("japanese") || v.name.toLowerCase().includes("japan"));

      if (jaVoice) {
        setJapaneseVoice(jaVoice);
      }
    };

    // 음성 목록이 비동기로 로드되는 경우 처리
    findJapaneseVoice();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = findJapaneseVoice;
    }

    // cleanup: 컴포넌트 언마운트 시 재생 중단
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // 연타 지원 단일 텍스트 발음
  const speak = useCallback(
    (text: string, options?: TTSOptions) => {
      if (!isSupported || !text.trim()) return;

      const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

      // 연타 처리: 이전 음성 즉시 중단
      window.speechSynthesis.cancel();
      isPlayingSequenceRef.current = false;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = mergedOptions.rate!;
      utterance.pitch = mergedOptions.pitch!;
      utterance.lang = mergedOptions.lang!;

      if (japaneseVoice) {
        utterance.voice = japaneseVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [isSupported, japaneseVoice]
  );

  // 순차 재생 (여러 텍스트를 순서대로 발음)
  const speakSequence = useCallback(
    (texts: string[], options?: TTSOptions) => {
      if (!isSupported || texts.length === 0) return;

      const filteredTexts = texts.filter((t) => t.trim());
      if (filteredTexts.length === 0) return;

      const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

      // 이전 재생 중단
      window.speechSynthesis.cancel();

      sequenceRef.current = filteredTexts;
      sequenceIndexRef.current = 0;
      isPlayingSequenceRef.current = true;

      const playNext = () => {
        if (!isPlayingSequenceRef.current) return;
        if (sequenceIndexRef.current >= sequenceRef.current.length) {
          isPlayingSequenceRef.current = false;
          setIsSpeaking(false);
          return;
        }

        const text = sequenceRef.current[sequenceIndexRef.current];
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = mergedOptions.rate!;
        utterance.pitch = mergedOptions.pitch!;
        utterance.lang = mergedOptions.lang!;

        if (japaneseVoice) {
          utterance.voice = japaneseVoice;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
          sequenceIndexRef.current++;
          // 다음 텍스트 재생 전 약간의 딜레이
          setTimeout(playNext, 300);
        };
        utterance.onerror = () => {
          isPlayingSequenceRef.current = false;
          setIsSpeaking(false);
        };

        window.speechSynthesis.speak(utterance);
      };

      playNext();
    },
    [isSupported, japaneseVoice]
  );

  // 재생 중단
  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    isPlayingSequenceRef.current = false;
    setIsSpeaking(false);
  }, [isSupported]);

  return {
    speak,
    speakSequence,
    stop,
    isSpeaking,
    isSupported,
    japaneseVoice,
  };
}

/**
 * TTS 자동재생 설정 관리
 */
const TTS_AUTO_PLAY_KEY = "kanji_tts_autoplay";

export function getTTSAutoPlaySetting(): boolean {
  if (typeof window === "undefined") return true;
  const saved = localStorage.getItem(TTS_AUTO_PLAY_KEY);
  return saved === null ? true : saved === "true";
}

export function setTTSAutoPlaySetting(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TTS_AUTO_PLAY_KEY, String(enabled));
}
