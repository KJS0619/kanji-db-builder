export type JlptLevel = "N1" | "N2" | "N3" | "N4" | "N5";

export const JLPT_LEVEL_OPTIONS: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

export interface CustomWord {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  pos: WordPOS;
  jlpt_level?: JlptLevel | null;
  source?: string;
  memo?: string;
  created_at: string;
}

export type WordPOS =
  | "명사"
  | "동사"
  | "い형용사"
  | "な형용사"
  | "부사"
  | "접속사"
  | "감탄사"
  | "조사"
  | "문법"
  | "기타";

export const POS_OPTIONS: WordPOS[] = [
  "명사",
  "동사",
  "い형용사",
  "な형용사",
  "부사",
  "접속사",
  "감탄사",
  "조사",
  "문법",
  "기타",
];

export interface WordFormData {
  word: string;
  reading: string;
  meaning: string;
  pos: WordPOS;
  jlpt_level?: JlptLevel | null;
  source?: string;
  memo?: string;
}
