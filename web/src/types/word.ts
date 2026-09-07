export interface CustomWord {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  pos: WordPOS;
  memo?: string;
  created_at: string;
}

export type WordPOS =
  | "명사"
  | "동사"
  | "い형용사"
  | "な형용사"
  | "부사"
  | "기타";

export const POS_OPTIONS: WordPOS[] = [
  "명사",
  "동사",
  "い형용사",
  "な형용사",
  "부사",
  "기타",
];

export interface WordFormData {
  word: string;
  reading: string;
  meaning: string;
  pos: WordPOS;
  memo?: string;
}
