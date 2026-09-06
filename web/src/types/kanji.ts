export interface StrokePath {
  order: number;
  path: string;
  start_x: number;
  start_y: number;
}

export interface Kanji {
  literal: string;
  unicode_hex: string;
  grade: number;
  jlpt_level: string;
  stroke_count: number;
  radical: number | null;
  frequency: number | null;
  korean_hun_eum: string | null;
  ja_on: string[];
  ja_kun: string[];
  meanings_en: string[];
  stroke_paths: StrokePath[];
}

export interface KanjiData {
  version: string;
  total_count: number;
  kanji: Kanji[];
}

export type JlptLevel = "all" | "N5" | "N4" | "N3" | "N2" | "N1";
export type GradeFilter = "all" | 1 | 2 | 3 | 4 | 5 | 6 | 8;

export const JLPT_COLORS: Record<string, string> = {
  N5: "bg-jlpt-n5",
  N4: "bg-jlpt-n4",
  N3: "bg-jlpt-n3",
  N2: "bg-jlpt-n2",
  N1: "bg-jlpt-n1",
};

export const JLPT_BORDER_COLORS: Record<string, string> = {
  N5: "border-jlpt-n5",
  N4: "border-jlpt-n4",
  N3: "border-jlpt-n3",
  N2: "border-jlpt-n2",
  N1: "border-jlpt-n1",
};

export const JLPT_TEXT_COLORS: Record<string, string> = {
  N5: "text-jlpt-n5",
  N4: "text-jlpt-n4",
  N3: "text-jlpt-n3",
  N2: "text-jlpt-n2",
  N1: "text-jlpt-n1",
};
