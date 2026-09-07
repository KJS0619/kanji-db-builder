import { Kanji } from "@/types/kanji";

// CJK Unified Ideographs range: U+4E00 to U+9FAF
const CJK_KANJI_REGEX = /[\u4E00-\u9FAF]/g;

/**
 * Extract unique kanji characters from a string
 */
export function extractKanji(text: string): string[] {
  const matches = text.match(CJK_KANJI_REGEX);
  if (!matches) return [];

  // Return unique kanji in order of appearance
  return Array.from(new Set(matches));
}

/**
 * Check if a character is a kanji
 */
export function isKanji(char: string): boolean {
  return CJK_KANJI_REGEX.test(char);
}

/**
 * Create a Map from kanji array for O(1) lookup
 */
export function createKanjiMap(kanjiList: Kanji[]): Map<string, Kanji> {
  const map = new Map<string, Kanji>();
  for (const kanji of kanjiList) {
    map.set(kanji.literal, kanji);
  }
  return map;
}

/**
 * Get kanji details for characters in a text
 */
export function getKanjiDetails(
  text: string,
  kanjiMap: Map<string, Kanji>
): Kanji[] {
  const kanjiChars = extractKanji(text);
  const details: Kanji[] = [];

  for (const char of kanjiChars) {
    const kanji = kanjiMap.get(char);
    if (kanji) {
      details.push(kanji);
    }
  }

  return details;
}

/**
 * Format korean hun eum for display (e.g., "책상 안" -> "안")
 * Returns the reading part (last word)
 */
export function formatKoreanReading(hunEum: string | null): string {
  if (!hunEum) return "";
  const parts = hunEum.trim().split(" ");
  return parts[parts.length - 1] || "";
}

/**
 * Count kanji in a string
 */
export function countKanji(text: string): number {
  const matches = text.match(CJK_KANJI_REGEX);
  return matches ? matches.length : 0;
}
