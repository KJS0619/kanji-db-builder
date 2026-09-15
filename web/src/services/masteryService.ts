/**
 * 학습 완료 상태 관리 서비스
 * localStorage를 사용하여 각 한자의 학습 상태를 영속화
 */

export interface MasteryData {
  isMastered: boolean;
  masteredAt: number | null;  // timestamp
  correctCount: number;
  incorrectCount: number;
  lastReviewedAt: number | null;
}

export interface MasteryRecord {
  [kanjiId: string]: MasteryData;
}

// 카드 타입별 스토리지 키
export type MasteryCategory =
  | 'kanji_diff'      // 한·일 차이 한자
  | 'kokuji'          // 국자
  | 'topic_kanji'     // 주제별 한자
  | 'radical'         // 부수
  | 'flashcard';      // 기본 플래시카드

const STORAGE_KEY_PREFIX = 'kanji_mastery_';

/**
 * 카테고리별 스토리지 키 생성
 */
function getStorageKey(category: MasteryCategory): string {
  return `${STORAGE_KEY_PREFIX}${category}`;
}

/**
 * 기본 마스터리 데이터
 */
function getDefaultMasteryData(): MasteryData {
  return {
    isMastered: false,
    masteredAt: null,
    correctCount: 0,
    incorrectCount: 0,
    lastReviewedAt: null,
  };
}

/**
 * 전체 마스터리 레코드 로드
 */
export function loadMasteryRecord(category: MasteryCategory): MasteryRecord {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(getStorageKey(category));
    if (stored) {
      return JSON.parse(stored) as MasteryRecord;
    }
  } catch (error) {
    console.error('Failed to load mastery data:', error);
  }
  return {};
}

/**
 * 전체 마스터리 레코드 저장
 */
export function saveMasteryRecord(category: MasteryCategory, record: MasteryRecord): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(getStorageKey(category), JSON.stringify(record));
  } catch (error) {
    console.error('Failed to save mastery data:', error);
  }
}

/**
 * 특정 카드의 마스터리 데이터 조회
 */
export function getMasteryData(category: MasteryCategory, kanjiId: string): MasteryData {
  const record = loadMasteryRecord(category);
  return record[kanjiId] || getDefaultMasteryData();
}

/**
 * 특정 카드를 '학습 완료'로 표시
 */
export function markAsMastered(category: MasteryCategory, kanjiId: string): MasteryData {
  const record = loadMasteryRecord(category);
  const existing = record[kanjiId] || getDefaultMasteryData();

  const updated: MasteryData = {
    ...existing,
    isMastered: true,
    masteredAt: Date.now(),
    correctCount: existing.correctCount + 1,
    lastReviewedAt: Date.now(),
  };

  record[kanjiId] = updated;
  saveMasteryRecord(category, record);

  return updated;
}

/**
 * 특정 카드를 '미완료'로 되돌리기
 */
export function markAsUnmastered(category: MasteryCategory, kanjiId: string): MasteryData {
  const record = loadMasteryRecord(category);
  const existing = record[kanjiId] || getDefaultMasteryData();

  const updated: MasteryData = {
    ...existing,
    isMastered: false,
    masteredAt: null,
    incorrectCount: existing.incorrectCount + 1,
    lastReviewedAt: Date.now(),
  };

  record[kanjiId] = updated;
  saveMasteryRecord(category, record);

  return updated;
}

/**
 * 학습 완료된 카드 ID 목록 조회
 */
export function getMasteredIds(category: MasteryCategory): string[] {
  const record = loadMasteryRecord(category);
  return Object.entries(record)
    .filter(([, data]) => data.isMastered)
    .map(([id]) => id);
}

/**
 * 학습 완료된 카드 개수 조회
 */
export function getMasteredCount(category: MasteryCategory): number {
  return getMasteredIds(category).length;
}

/**
 * 미완료 카드 ID 목록 조회 (전체 ID 목록 필요)
 */
export function getUnmasteredIds(category: MasteryCategory, allIds: string[]): string[] {
  const record = loadMasteryRecord(category);
  return allIds.filter(id => !record[id]?.isMastered);
}

/**
 * 마스터리 상태 토글
 */
export function toggleMastery(category: MasteryCategory, kanjiId: string): MasteryData {
  const current = getMasteryData(category, kanjiId);
  if (current.isMastered) {
    return markAsUnmastered(category, kanjiId);
  } else {
    return markAsMastered(category, kanjiId);
  }
}

/**
 * 테스트 결과 기록 (정답)
 */
export function recordCorrectAnswer(category: MasteryCategory, kanjiId: string): MasteryData {
  const record = loadMasteryRecord(category);
  const existing = record[kanjiId] || getDefaultMasteryData();

  const updated: MasteryData = {
    ...existing,
    correctCount: existing.correctCount + 1,
    lastReviewedAt: Date.now(),
  };

  record[kanjiId] = updated;
  saveMasteryRecord(category, record);

  return updated;
}

/**
 * 테스트 결과 기록 (오답 - 마스터리 해제)
 */
export function recordIncorrectAnswer(category: MasteryCategory, kanjiId: string): MasteryData {
  return markAsUnmastered(category, kanjiId);
}

/**
 * 전체 마스터리 데이터 초기화
 */
export function resetAllMastery(category: MasteryCategory): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(getStorageKey(category));
}

/**
 * 통계 데이터 조회
 */
export interface MasteryStats {
  totalMastered: number;
  totalReviewed: number;
  totalCorrect: number;
  totalIncorrect: number;
  accuracy: number;  // 0-100
}

export function getMasteryStats(category: MasteryCategory): MasteryStats {
  const record = loadMasteryRecord(category);
  const entries = Object.values(record);

  const totalMastered = entries.filter(d => d.isMastered).length;
  const totalReviewed = entries.length;
  const totalCorrect = entries.reduce((sum, d) => sum + d.correctCount, 0);
  const totalIncorrect = entries.reduce((sum, d) => sum + d.incorrectCount, 0);
  const total = totalCorrect + totalIncorrect;
  const accuracy = total > 0 ? Math.round((totalCorrect / total) * 100) : 0;

  return {
    totalMastered,
    totalReviewed,
    totalCorrect,
    totalIncorrect,
    accuracy,
  };
}
