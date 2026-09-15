"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
import { Kanji, JLPT_COLORS } from "@/types/kanji";
import clsx from "clsx";
import {
  GenericFlashcardPrintModal,
  PrintableCard,
} from "@/components/GenericFlashcardPrintModal";
import {
  WritingPracticePrintModal,
  WritingPracticeItem,
} from "@/components/WritingPracticePrintModal";

interface RadicalKanjiModalProps {
  kanjiList: Kanji[];
  onClose: () => void;
}

// 한·일 차이 한자 데이터 타입
interface KanjiDiff {
  id: string;
  krTraditional: string;
  jpShinjitai: string;
  krSound: string;
  jpOn: string;
  jpKun: string;
  diffCategory: string;
}

interface KanjiDiffData {
  kanji: KanjiDiff[];
}

// 강희자전 214 부수 매핑 (번호 → 부수 문자)
const RADICAL_MAP: Record<number, { char: string; name: string }> = {
  1: { char: "一", name: "한 일" },
  2: { char: "丨", name: "뚫을 곤" },
  3: { char: "丶", name: "점 주" },
  4: { char: "丿", name: "삐침 별" },
  5: { char: "乙", name: "새 을" },
  6: { char: "亅", name: "갈고리 궐" },
  7: { char: "二", name: "두 이" },
  8: { char: "亠", name: "돼지해머리" },
  9: { char: "人", name: "사람 인" },
  10: { char: "儿", name: "어진사람" },
  11: { char: "入", name: "들 입" },
  12: { char: "八", name: "여덟 팔" },
  13: { char: "冂", name: "멀 경" },
  14: { char: "冖", name: "덮을 멱" },
  15: { char: "冫", name: "얼음 빙" },
  16: { char: "几", name: "안석 궤" },
  17: { char: "凵", name: "받침 감" },
  18: { char: "刀", name: "칼 도" },
  19: { char: "力", name: "힘 력" },
  20: { char: "勹", name: "쌀 포" },
  21: { char: "匕", name: "비수 비" },
  22: { char: "匚", name: "상자 방" },
  23: { char: "匸", name: "감출 혜" },
  24: { char: "十", name: "열 십" },
  25: { char: "卜", name: "점 복" },
  26: { char: "卩", name: "병부 절" },
  27: { char: "厂", name: "언덕 한" },
  28: { char: "厶", name: "사사 사" },
  29: { char: "又", name: "또 우" },
  30: { char: "口", name: "입 구" },
  31: { char: "囗", name: "에울 위" },
  32: { char: "土", name: "흙 토" },
  33: { char: "士", name: "선비 사" },
  34: { char: "夂", name: "뒤져올 치" },
  35: { char: "夊", name: "천천히걸을 쇠" },
  36: { char: "夕", name: "저녁 석" },
  37: { char: "大", name: "큰 대" },
  38: { char: "女", name: "계집 녀" },
  39: { char: "子", name: "아들 자" },
  40: { char: "宀", name: "집 면" },
  41: { char: "寸", name: "마디 촌" },
  42: { char: "小", name: "작을 소" },
  43: { char: "尢", name: "절름발이 왕" },
  44: { char: "尸", name: "주검 시" },
  45: { char: "屮", name: "싹 철" },
  46: { char: "山", name: "메 산" },
  47: { char: "巛", name: "내 천" },
  48: { char: "工", name: "장인 공" },
  49: { char: "己", name: "몸 기" },
  50: { char: "巾", name: "수건 건" },
  51: { char: "干", name: "방패 간" },
  52: { char: "幺", name: "작을 요" },
  53: { char: "广", name: "집 엄" },
  54: { char: "廴", name: "끌 인" },
  55: { char: "廾", name: "두손 공" },
  56: { char: "弋", name: "주살 익" },
  57: { char: "弓", name: "활 궁" },
  58: { char: "彐", name: "돼지머리 계" },
  59: { char: "彡", name: "터럭 삼" },
  60: { char: "彳", name: "조금걸을 척" },
  61: { char: "心", name: "마음 심" },
  62: { char: "戈", name: "창 과" },
  63: { char: "戶", name: "지게 호" },
  64: { char: "手", name: "손 수" },
  65: { char: "支", name: "지탱할 지" },
  66: { char: "攴", name: "칠 복" },
  67: { char: "文", name: "글월 문" },
  68: { char: "斗", name: "말 두" },
  69: { char: "斤", name: "도끼 근" },
  70: { char: "方", name: "모 방" },
  71: { char: "无", name: "없을 무" },
  72: { char: "日", name: "날 일" },
  73: { char: "曰", name: "가로 왈" },
  74: { char: "月", name: "달 월" },
  75: { char: "木", name: "나무 목" },
  76: { char: "欠", name: "하품 흠" },
  77: { char: "止", name: "그칠 지" },
  78: { char: "歹", name: "부서질뼈 알" },
  79: { char: "殳", name: "몽둥이 수" },
  80: { char: "毋", name: "말 무" },
  81: { char: "比", name: "견줄 비" },
  82: { char: "毛", name: "터럭 모" },
  83: { char: "氏", name: "성씨 씨" },
  84: { char: "气", name: "기운 기" },
  85: { char: "水", name: "물 수" },
  86: { char: "火", name: "불 화" },
  87: { char: "爪", name: "손톱 조" },
  88: { char: "父", name: "아비 부" },
  89: { char: "爻", name: "사귈 효" },
  90: { char: "爿", name: "조각 장" },
  91: { char: "片", name: "조각 편" },
  92: { char: "牙", name: "어금니 아" },
  93: { char: "牛", name: "소 우" },
  94: { char: "犬", name: "개 견" },
  95: { char: "玄", name: "검을 현" },
  96: { char: "玉", name: "구슬 옥" },
  97: { char: "瓜", name: "오이 과" },
  98: { char: "瓦", name: "기와 와" },
  99: { char: "甘", name: "달 감" },
  100: { char: "生", name: "날 생" },
  101: { char: "用", name: "쓸 용" },
  102: { char: "田", name: "밭 전" },
  103: { char: "疋", name: "필 필" },
  104: { char: "疒", name: "병질 녁" },
  105: { char: "癶", name: "필 발" },
  106: { char: "白", name: "흰 백" },
  107: { char: "皮", name: "가죽 피" },
  108: { char: "皿", name: "그릇 명" },
  109: { char: "目", name: "눈 목" },
  110: { char: "矛", name: "창 모" },
  111: { char: "矢", name: "화살 시" },
  112: { char: "石", name: "돌 석" },
  113: { char: "示", name: "보일 시" },
  114: { char: "禸", name: "발없는벌레 유" },
  115: { char: "禾", name: "벼 화" },
  116: { char: "穴", name: "굴 혈" },
  117: { char: "立", name: "설 립" },
  118: { char: "竹", name: "대 죽" },
  119: { char: "米", name: "쌀 미" },
  120: { char: "糸", name: "실 사" },
  121: { char: "缶", name: "장군 부" },
  122: { char: "网", name: "그물 망" },
  123: { char: "羊", name: "양 양" },
  124: { char: "羽", name: "깃 우" },
  125: { char: "老", name: "늙을 로" },
  126: { char: "而", name: "말이을 이" },
  127: { char: "耒", name: "쟁기 뢰" },
  128: { char: "耳", name: "귀 이" },
  129: { char: "聿", name: "붓 율" },
  130: { char: "肉", name: "고기 육" },
  131: { char: "臣", name: "신하 신" },
  132: { char: "自", name: "스스로 자" },
  133: { char: "至", name: "이를 지" },
  134: { char: "臼", name: "절구 구" },
  135: { char: "舌", name: "혀 설" },
  136: { char: "舛", name: "어긋날 천" },
  137: { char: "舟", name: "배 주" },
  138: { char: "艮", name: "그칠 간" },
  139: { char: "色", name: "빛 색" },
  140: { char: "艸", name: "풀 초" },
  141: { char: "虍", name: "범호피무늬" },
  142: { char: "虫", name: "벌레 충" },
  143: { char: "血", name: "피 혈" },
  144: { char: "行", name: "다닐 행" },
  145: { char: "衣", name: "옷 의" },
  146: { char: "襾", name: "덮을 아" },
  147: { char: "見", name: "볼 견" },
  148: { char: "角", name: "뿔 각" },
  149: { char: "言", name: "말씀 언" },
  150: { char: "谷", name: "골 곡" },
  151: { char: "豆", name: "콩 두" },
  152: { char: "豕", name: "돼지 시" },
  153: { char: "豸", name: "벌레 치" },
  154: { char: "貝", name: "조개 패" },
  155: { char: "赤", name: "붉을 적" },
  156: { char: "走", name: "달릴 주" },
  157: { char: "足", name: "발 족" },
  158: { char: "身", name: "몸 신" },
  159: { char: "車", name: "수레 차" },
  160: { char: "辛", name: "매울 신" },
  161: { char: "辰", name: "별 진" },
  162: { char: "辵", name: "갈 착" },
  163: { char: "邑", name: "고을 읍" },
  164: { char: "酉", name: "닭 유" },
  165: { char: "釆", name: "분별할 변" },
  166: { char: "里", name: "마을 리" },
  167: { char: "金", name: "쇠 금" },
  168: { char: "長", name: "길 장" },
  169: { char: "門", name: "문 문" },
  170: { char: "阜", name: "언덕 부" },
  171: { char: "隶", name: "미칠 이" },
  172: { char: "隹", name: "새 추" },
  173: { char: "雨", name: "비 우" },
  174: { char: "靑", name: "푸를 청" },
  175: { char: "非", name: "아닐 비" },
  176: { char: "面", name: "얼굴 면" },
  177: { char: "革", name: "가죽 혁" },
  178: { char: "韋", name: "가죽 위" },
  179: { char: "韭", name: "부추 구" },
  180: { char: "音", name: "소리 음" },
  181: { char: "頁", name: "머리 혈" },
  182: { char: "風", name: "바람 풍" },
  183: { char: "飛", name: "날 비" },
  184: { char: "食", name: "먹을 식" },
  185: { char: "首", name: "머리 수" },
  186: { char: "香", name: "향기 향" },
  187: { char: "馬", name: "말 마" },
  188: { char: "骨", name: "뼈 골" },
  189: { char: "高", name: "높을 고" },
  190: { char: "髟", name: "터럭 표" },
  191: { char: "鬥", name: "싸울 투" },
  192: { char: "鬯", name: "울창주 창" },
  193: { char: "鬲", name: "솥 력" },
  194: { char: "鬼", name: "귀신 귀" },
  195: { char: "魚", name: "물고기 어" },
  196: { char: "鳥", name: "새 조" },
  197: { char: "鹵", name: "소금 로" },
  198: { char: "鹿", name: "사슴 록" },
  199: { char: "麥", name: "보리 맥" },
  200: { char: "麻", name: "삼 마" },
  201: { char: "黃", name: "누를 황" },
  202: { char: "黍", name: "기장 서" },
  203: { char: "黑", name: "검을 흑" },
  204: { char: "黹", name: "바느질 치" },
  205: { char: "黽", name: "맹꽁이 맹" },
  206: { char: "鼎", name: "솥 정" },
  207: { char: "鼓", name: "북 고" },
  208: { char: "鼠", name: "쥐 서" },
  209: { char: "鼻", name: "코 비" },
  210: { char: "齊", name: "가지런할 제" },
  211: { char: "齒", name: "이 치" },
  212: { char: "龍", name: "용 룡" },
  213: { char: "龜", name: "거북 귀" },
  214: { char: "龠", name: "피리 약" },
};

// Fisher-Yates 셔플 알고리즘
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function RadicalKanjiModal({ kanjiList, onClose }: RadicalKanjiModalProps) {
  const [selectedRadical, setSelectedRadical] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [deck, setDeck] = useState<Kanji[]>([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showWritingPracticeModal, setShowWritingPracticeModal] = useState(false);

  // 한·일 차이 한자 데이터
  const [kanjiDiffMap, setKanjiDiffMap] = useState<Map<string, KanjiDiff>>(new Map());

  // 한·일 차이 데이터 로드
  useEffect(() => {
    fetch("/data/kanji_diff_full.json")
      .then((res) => res.json())
      .then((data: KanjiDiffData) => {
        // 일본 신자체(literal) → 한국 정자 매핑
        const map = new Map<string, KanjiDiff>();
        data.kanji.forEach((k) => {
          map.set(k.jpShinjitai, k);
        });
        setKanjiDiffMap(map);
      })
      .catch((err) => {
        console.error("Failed to load kanji_diff_full.json:", err);
      });
  }, []);

  // 부수별로 한자 그룹화
  const kanjiByRadical = useMemo(() => {
    const grouped: Record<number, Kanji[]> = {};
    kanjiList.forEach((kanji) => {
      const radicalNum = kanji.radical;
      if (radicalNum && radicalNum >= 1 && radicalNum <= 214) {
        if (!grouped[radicalNum]) {
          grouped[radicalNum] = [];
        }
        grouped[radicalNum].push(kanji);
      }
    });
    return grouped;
  }, [kanjiList]);

  // 존재하는 부수 목록 (한자가 있는 부수만)
  const availableRadicals = useMemo(() => {
    return Object.keys(kanjiByRadical)
      .map(Number)
      .sort((a, b) => a - b);
  }, [kanjiByRadical]);

  // 초기 부수 선택
  useEffect(() => {
    if (availableRadicals.length > 0 && selectedRadical === null) {
      setSelectedRadical(availableRadicals[0]);
    }
  }, [availableRadicals, selectedRadical]);

  // 현재 부수의 한자 목록
  const currentRadicalKanji = useMemo(() => {
    if (selectedRadical === null) return [];
    return kanjiByRadical[selectedRadical] || [];
  }, [kanjiByRadical, selectedRadical]);

  // 덱 초기화
  useEffect(() => {
    if (currentRadicalKanji.length > 0) {
      setDeck(shuffleArray(currentRadicalKanji));
      setCurrentIndex(0);
      setIsFlipped(false);
    } else {
      setDeck([]);
    }
  }, [currentRadicalKanji]);

  // 인쇄용 카드 데이터 변환
  const printableCards: PrintableCard[] = useMemo(() => {
    const radicalInfo = selectedRadical ? RADICAL_MAP[selectedRadical] : null;
    return deck.map((k, idx) => {
      const diffData = kanjiDiffMap.get(k.literal);
      return {
        id: `radical-kanji-${idx}`,
        frontContent: {
          main: k.literal,
          mainKr: diffData?.krTraditional,  // 한·일 차이 있으면 한국 정자
          mainJp: diffData ? k.literal : undefined,  // 한·일 차이 있으면 일본 신자체
          sub: `${k.jlpt_level} · ${k.stroke_count}획 · ${radicalInfo?.char || ""} 부`,
        },
        backContent: {
          primary: diffData?.krSound || k.korean_hun_eum || "-",
          primaryLang: "ko" as const,
          secondary: k.ja_on.length > 0 ? `音: ${k.ja_on.join(", ")}` : undefined,
          secondaryLang: "ja" as const,
          tertiary: k.ja_kun.length > 0 ? `訓: ${k.ja_kun.slice(0, 3).join(", ")}` : undefined,
        },
      };
    });
  }, [deck, selectedRadical, kanjiDiffMap]);

  // 쓰기연습용 데이터 변환
  const writingPracticeItems: WritingPracticeItem[] = useMemo(() => {
    const radicalInfo = selectedRadical ? RADICAL_MAP[selectedRadical] : null;
    return deck.map((k, idx) => {
      const diffData = kanjiDiffMap.get(k.literal);
      return {
        id: `writing-radical-${selectedRadical}-${idx}`,
        literal: k.literal,
        hunEum: diffData?.krSound || k.korean_hun_eum || "-",
        strokePaths: k.stroke_paths,
      };
    });
  }, [deck, selectedRadical, kanjiDiffMap]);

  // 덱 셔플
  const handleShuffle = useCallback(() => {
    setDeck(shuffleArray(currentRadicalKanji));
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [currentRadicalKanji]);

  // 카드 뒤집기
  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  // 다음 카드
  const handleNext = useCallback(() => {
    if (currentIndex < deck.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    }
  }, [currentIndex, deck.length]);

  // 이전 카드
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case " ":
        case "Enter":
          e.preventDefault();
          handleFlip();
          break;
        case "ArrowLeft":
          handlePrev();
          break;
        case "ArrowRight":
          handleNext();
          break;
        case "r":
        case "R":
          handleShuffle();
          break;
        case "Escape":
          onClose();
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFlip, handlePrev, handleNext, handleShuffle, onClose]);

  // 배경 클릭으로 닫기
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const currentKanji = deck[currentIndex];
  const radicalInfo = selectedRadical ? RADICAL_MAP[selectedRadical] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/60"
      onClick={handleBackdropClick}
    >
      <div
        className={clsx(
          "relative w-full max-w-lg mx-4 sm:mx-0",
          "bg-white dark:bg-gray-900 rounded-2xl",
          "shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🔤</span>
            부수별 한자 플래시카드
          </h2>
          <div className="flex items-center gap-2">
            {/* 쓰기연습 버튼 */}
            <button
              onClick={() => setShowWritingPracticeModal(true)}
              disabled={deck.length === 0}
              className={clsx(
                "p-2 rounded-lg transition-colors",
                deck.length === 0
                  ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800 text-green-600 dark:text-green-400"
              )}
              title="쓰기연습 PDF"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            {/* 인쇄 버튼 */}
            <button
              onClick={() => setShowPrintModal(true)}
              disabled={deck.length === 0}
              className={clsx(
                "p-2 rounded-lg transition-colors",
                deck.length === 0
                  ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
              )}
              title="플래시카드 인쇄"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg
                className="w-5 h-5 text-gray-600 dark:text-gray-300"
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

        {/* 부수 선택 - 스크롤 가능한 그리드 */}
        <div className="max-h-32 overflow-y-auto border-b border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex flex-wrap gap-1">
            {availableRadicals.map((radicalNum) => {
              const info = RADICAL_MAP[radicalNum];
              const count = kanjiByRadical[radicalNum]?.length || 0;
              return (
                <button
                  key={radicalNum}
                  onClick={() => setSelectedRadical(radicalNum)}
                  className={clsx(
                    "px-2 py-1 text-sm font-medium rounded transition-all flex items-center gap-1",
                    selectedRadical === radicalNum
                      ? "bg-teal-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  )}
                  title={info?.name || `부수 ${radicalNum}`}
                >
                  <span className="text-base">{info?.char || "?"}</span>
                  <span className="text-xs opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 현재 부수 정보 */}
        {radicalInfo && (
          <div className="px-4 py-2 bg-teal-50 dark:bg-teal-900/30 border-b border-teal-200 dark:border-teal-800">
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl">{radicalInfo.char}</span>
              <div className="text-center">
                <p className="text-sm font-bold text-teal-700 dark:text-teal-300">
                  {radicalInfo.name}
                </p>
                <p className="text-xs text-teal-600 dark:text-teal-400">
                  제{selectedRadical}부 · {currentRadicalKanji.length}자
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 진행률 & 셔플 */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {deck.length > 0 ? currentIndex + 1 : 0} / {deck.length}
            </span>
            {/* 프로그레스 바 */}
            <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 transition-all"
                style={{
                  width: deck.length > 0 ? `${((currentIndex + 1) / deck.length) * 100}%` : "0%",
                }}
              />
            </div>
          </div>
          <button
            onClick={handleShuffle}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            섞기
          </button>
        </div>

        {/* 플래시카드 */}
        {deck.length > 0 && currentKanji ? (
          <div className="p-6 flex-1 overflow-auto">
            <div
              className="flashcard-container w-full h-64 sm:h-72 cursor-pointer"
              onClick={handleFlip}
            >
              <div className={clsx("flashcard w-full h-full", isFlipped && "flipped")}>
                {/* 앞면 - 한자 */}
                <div
                  className={clsx(
                    "flashcard-face flex flex-col items-center justify-center",
                    "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900",
                    "border-2 border-gray-200 dark:border-gray-700",
                    "shadow-lg rounded-xl"
                  )}
                >
                  {/* 한·일 차이가 있는 한자는 좌우 대비 */}
                  {kanjiDiffMap.get(currentKanji.literal) ? (
                    <div className="flex items-center gap-3">
                      {/* 한국 정자 */}
                      <div className="text-center">
                        <span className="text-xs text-blue-500 dark:text-blue-400 block mb-1">한국</span>
                        <span
                          lang="ko"
                          className="kanji-kr text-6xl sm:text-7xl font-bold text-blue-600 dark:text-blue-400 select-none"
                        >
                          {kanjiDiffMap.get(currentKanji.literal)?.krTraditional}
                        </span>
                      </div>
                      {/* 화살표 */}
                      <span className="text-2xl text-gray-400">→</span>
                      {/* 일본 신자체 */}
                      <div className="text-center">
                        <span className="text-xs text-red-500 dark:text-red-400 block mb-1">일본</span>
                        <span
                          lang="ja"
                          className="kanji-jp text-6xl sm:text-7xl font-bold text-red-600 dark:text-red-400 select-none"
                        >
                          {currentKanji.literal}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span
                      lang="ja"
                      className={clsx(
                        "kanji-jp text-8xl sm:text-9xl font-bold text-gray-900 dark:text-white",
                        "select-none"
                      )}
                    >
                      {currentKanji.literal}
                    </span>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <span
                      className={clsx(
                        "px-2 py-0.5 text-xs font-bold text-white rounded",
                        JLPT_COLORS[currentKanji.jlpt_level]
                      )}
                    >
                      {currentKanji.jlpt_level}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {currentKanji.stroke_count}획
                    </span>
                    <span lang="ko" className="kanji-kr text-sm text-teal-600 dark:text-teal-400">
                      {radicalInfo?.char} 부
                    </span>
                    {kanjiDiffMap.get(currentKanji.literal) && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">
                        한·일 차이
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">클릭하여 뒤집기</p>
                </div>

                {/* 뒷면 - 정보 */}
                <div
                  className={clsx(
                    "flashcard-face flashcard-back flex flex-col items-center justify-center p-6",
                    "bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/30 dark:to-cyan-900/30",
                    "border-2 border-teal-200 dark:border-teal-800",
                    "shadow-lg rounded-xl"
                  )}
                >
                  {/* 한·일 차이 한자 대비 (차이 있는 경우) */}
                  {kanjiDiffMap.get(currentKanji.literal) && (
                    <div className="flex items-center gap-3 mb-2">
                      <span lang="ko" className="kanji-kr text-2xl text-blue-500">
                        {kanjiDiffMap.get(currentKanji.literal)?.krTraditional}
                      </span>
                      <span className="text-lg text-gray-400">→</span>
                      <span lang="ja" className="kanji-jp text-2xl text-red-500">
                        {currentKanji.literal}
                      </span>
                    </div>
                  )}

                  {/* 한국어 훈음 - diff 데이터 우선, 없으면 기존 데이터 */}
                  <p className="text-2xl sm:text-3xl font-bold text-teal-600 dark:text-teal-400 mb-4">
                    {kanjiDiffMap.get(currentKanji.literal)?.krSound || currentKanji.korean_hun_eum || "-"}
                  </p>

                  <div className="w-full space-y-2 text-sm">
                    {/* 음독 */}
                    {currentKanji.ja_on.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-14 font-medium text-gray-500 dark:text-gray-400">
                          音読み
                        </span>
                        <span lang="ja" className="text-gray-800 dark:text-gray-200">
                          {currentKanji.ja_on.join(", ")}
                        </span>
                      </div>
                    )}

                    {/* 훈독 */}
                    {currentKanji.ja_kun.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-14 font-medium text-gray-500 dark:text-gray-400">
                          訓読み
                        </span>
                        <span lang="ja" className="text-gray-800 dark:text-gray-200">
                          {currentKanji.ja_kun.join(", ")}
                        </span>
                      </div>
                    )}

                    {/* 영문 의미 */}
                    {currentKanji.meanings_en.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-14 font-medium text-gray-500 dark:text-gray-400">
                          English
                        </span>
                        <span className="text-gray-800 dark:text-gray-200">
                          {currentKanji.meanings_en.slice(0, 4).join(", ")}
                        </span>
                      </div>
                    )}

                    {/* 소속 부수 */}
                    <div className="flex items-start gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="flex-shrink-0 w-14 font-medium text-gray-500 dark:text-gray-400">
                        부수
                      </span>
                      <span lang="ko" className="kanji-kr text-gray-800 dark:text-gray-200">
                        {radicalInfo?.char} ({radicalInfo?.name})
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">클릭하여 뒤집기</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 sm:h-72 text-gray-500 dark:text-gray-400">
            이 부수에 해당하는 한자가 없습니다
          </div>
        )}

        {/* 컨트롤 버튼 */}
        <div className="flex items-center justify-center gap-3 px-6 pb-6">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0 || deck.length === 0}
            className={clsx(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all",
              currentIndex === 0 || deck.length === 0
                ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
            )}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            이전
          </button>

          <button
            onClick={handleFlip}
            disabled={deck.length === 0}
            className={clsx(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all",
              deck.length === 0
                ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                : "bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-600/30"
            )}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            뒤집기
          </button>

          <button
            onClick={handleNext}
            disabled={currentIndex === deck.length - 1 || deck.length === 0}
            className={clsx(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all",
              currentIndex === deck.length - 1 || deck.length === 0
                ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
            )}
          >
            다음
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* 단축키 안내 */}
        <div className="px-6 pb-4 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            단축키: <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">Space</kbd>{" "}
            뒤집기 ·
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded mx-1">←→</kbd>{" "}
            이전/다음 ·<kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">R</kbd> 섞기
            ·<kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">ESC</kbd> 닫기
          </p>
        </div>
      </div>

      {/* 인쇄 모달 */}
      {showPrintModal && (
        <GenericFlashcardPrintModal
          title={`부수별 한자 - ${radicalInfo?.char || ""} ${radicalInfo?.name || ""}`}
          cards={printableCards}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* 쓰기연습 모달 */}
      {showWritingPracticeModal && (
        <WritingPracticePrintModal
          title={`부수별 한자 - ${radicalInfo?.char || ""} ${radicalInfo?.name || ""}`}
          items={writingPracticeItems}
          onClose={() => setShowWritingPracticeModal(false)}
        />
      )}
    </div>
  );
}
