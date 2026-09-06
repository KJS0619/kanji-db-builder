#!/usr/bin/env python3
"""
kanji-db-builder: SQLite/JSON 데이터베이스 빌드 스크립트

원천 데이터를 파싱하여 kanji_master.db (SQLite)와
kanji_master.json 파일을 생성합니다.

사용법:
    python scripts/build_db.py

출력:
    data/output/kanji_master.db
    data/output/kanji_master.json
"""

import json
import re
import sqlite3
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False


# 프로젝트 경로 설정
PROJECT_ROOT = Path(__file__).parent.parent
RAW_DATA_DIR = PROJECT_ROOT / "data" / "raw"
OUTPUT_DIR = PROJECT_ROOT / "data" / "output"

# 파일 경로
KANJIDIC2_PATH = RAW_DATA_DIR / "kanjidic2.xml"
KANJIVG_PATH = RAW_DATA_DIR / "kanjivg.xml"
UNIHAN_READINGS_PATH = RAW_DATA_DIR / "Unihan_Readings.txt"
UNIHAN_VARIANTS_PATH = RAW_DATA_DIR / "Unihan_Variants.txt"
JLPT_MAPPING_PATH = RAW_DATA_DIR / "jlpt_mapping.json"
KOREAN_HUNEUM_PATH = RAW_DATA_DIR / "korean_huneum.json"

OUTPUT_DB_PATH = OUTPUT_DIR / "kanji_master.db"
OUTPUT_JSON_PATH = OUTPUT_DIR / "kanji_master.json"


def progress_bar(iterable, desc: str = None, total: int = None):
    """진행률 표시 래퍼"""
    if HAS_TQDM:
        return tqdm(iterable, desc=desc, total=total)
    else:
        if desc:
            print(f"  Processing: {desc}...")
        return iterable


class KanjiDictParser:
    """KANJIDIC2 XML 파서"""

    def __init__(self, xml_path: Path):
        self.xml_path = xml_path
        self.kanji_data: Dict[str, dict] = {}

    def parse(self) -> Dict[str, dict]:
        """상용 한자(grade 1-6, 8) 파싱"""
        print("\n[1/5] KANJIDIC2 파싱")
        print("-" * 40)

        if not self.xml_path.exists():
            raise FileNotFoundError(f"KANJIDIC2 not found: {self.xml_path}")

        # iterparse로 메모리 효율적 파싱
        context = ET.iterparse(self.xml_path, events=('end',))

        count = 0
        joyo_count = 0

        for event, elem in context:
            if elem.tag == 'character':
                kanji_info = self._parse_character(elem)

                if kanji_info and kanji_info.get('grade') in [1, 2, 3, 4, 5, 6, 8]:
                    literal = kanji_info['literal']
                    self.kanji_data[literal] = kanji_info
                    joyo_count += 1

                count += 1

                # 메모리 정리
                elem.clear()

        print(f"  Total characters scanned: {count}")
        print(f"  Joyo kanji extracted: {joyo_count}")

        return self.kanji_data

    def _parse_character(self, elem: ET.Element) -> Optional[dict]:
        """개별 한자 요소 파싱"""
        literal_elem = elem.find('literal')
        if literal_elem is None or literal_elem.text is None:
            return None

        literal = literal_elem.text
        codepoint = ord(literal)
        unicode_hex = f"{codepoint:05x}"

        # misc 정보
        misc = elem.find('misc')
        grade = None
        stroke_count = None
        frequency = None

        if misc is not None:
            grade_elem = misc.find('grade')
            if grade_elem is not None and grade_elem.text:
                grade = int(grade_elem.text)

            stroke_elem = misc.find('stroke_count')
            if stroke_elem is not None and stroke_elem.text:
                stroke_count = int(stroke_elem.text)

            freq_elem = misc.find('freq')
            if freq_elem is not None and freq_elem.text:
                frequency = int(freq_elem.text)

        # 부수 정보
        radical = None
        rad_elem = elem.find('.//rad_value[@rad_type="classical"]')
        if rad_elem is not None and rad_elem.text:
            radical = int(rad_elem.text)

        # 음훈독
        ja_on = []
        ja_kun = []

        rmgroup = elem.find('.//rmgroup')
        if rmgroup is not None:
            for reading in rmgroup.findall('reading'):
                r_type = reading.get('r_type')
                if reading.text:
                    if r_type == 'ja_on':
                        ja_on.append(reading.text)
                    elif r_type == 'ja_kun':
                        ja_kun.append(reading.text)

        # 영문 의미
        meanings_en = []
        if rmgroup is not None:
            for meaning in rmgroup.findall('meaning'):
                if meaning.get('m_lang') is None and meaning.text:
                    meanings_en.append(meaning.text)

        return {
            'literal': literal,
            'unicode_hex': unicode_hex,
            'grade': grade,
            'stroke_count': stroke_count or 0,
            'radical': radical,
            'frequency': frequency,
            'ja_on': ja_on,
            'ja_kun': ja_kun,
            'meanings_en': meanings_en
        }


class KanjiVGParser:
    """KanjiVG XML 파서 - 획순 SVG 데이터 추출"""

    def __init__(self, xml_path: Path):
        self.xml_path = xml_path
        self.stroke_data: Dict[str, List[dict]] = {}

    def parse(self, target_kanji: set) -> Dict[str, List[dict]]:
        """대상 한자의 획순 데이터 파싱"""
        print("\n[2/5] KanjiVG 파싱")
        print("-" * 40)

        if not self.xml_path.exists():
            raise FileNotFoundError(f"KanjiVG not found: {self.xml_path}")

        # KanjiVG XML 네임스페이스
        namespaces = {
            'svg': 'http://www.w3.org/2000/svg',
            'kvg': 'http://kanjivg.tagaini.net'
        }

        # iterparse로 메모리 효율적 파싱
        context = ET.iterparse(self.xml_path, events=('end',))

        found_count = 0

        for event, elem in context:
            if elem.tag == 'kanji':
                kanji_id = elem.get('id', '')

                # ID 형식: kanji_XXXXX (5자리 hex)
                if kanji_id.startswith('kanji_'):
                    hex_code = kanji_id[6:]  # "kanji_" 제거
                    try:
                        codepoint = int(hex_code, 16)
                        literal = chr(codepoint)

                        if literal in target_kanji:
                            strokes = self._parse_strokes(elem, namespaces)
                            if strokes:
                                self.stroke_data[literal] = strokes
                                found_count += 1
                    except (ValueError, OverflowError):
                        pass

                # 메모리 정리
                elem.clear()

        print(f"  Stroke data extracted: {found_count}/{len(target_kanji)}")

        return self.stroke_data

    def _parse_strokes(self, kanji_elem: ET.Element, ns: dict) -> List[dict]:
        """획순 경로 추출"""
        strokes = []
        order = 1

        # 모든 path 요소 찾기 (재귀적)
        for path in kanji_elem.iter('path'):
            path_id = path.get('id', '')
            d = path.get('d', '')

            if d:
                # 획 시작점 추출 (M x,y 또는 M x y)
                start_x, start_y = self._extract_start_point(d)

                strokes.append({
                    'order': order,
                    'path': d,
                    'start_x': start_x,
                    'start_y': start_y
                })
                order += 1

        return strokes

    def _extract_start_point(self, path_d: str) -> Tuple[float, float]:
        """SVG path의 시작점 좌표 추출"""
        # M x,y 또는 M x y 형식
        match = re.match(r'M\s*([\d.]+)[,\s]+([\d.]+)', path_d)
        if match:
            return float(match.group(1)), float(match.group(2))
        return 0.0, 0.0


class UnihanParser:
    """Unihan Database 파서 - 한국어 독음 추출"""

    def __init__(self, readings_path: Path, variants_path: Path):
        self.readings_path = readings_path
        self.variants_path = variants_path
        self.hangul_readings: Dict[str, str] = {}
        self.traditional_variants: Dict[str, str] = {}

    def parse(self, target_kanji: set) -> Dict[str, str]:
        """한국어 독음 및 변형자 파싱"""
        print("\n[3/5] Unihan 파싱")
        print("-" * 40)

        # 전통 한자 변형 로드
        self._parse_variants()

        # 한글 독음 로드
        self._parse_readings()

        # 대상 한자에 대한 독음 매핑
        result = {}
        found = 0
        fallback = 0

        for kanji in target_kanji:
            reading = self._get_korean_reading(kanji)
            if reading:
                result[kanji] = reading
                found += 1
            else:
                fallback += 1

        print(f"  Korean readings found: {found}")
        print(f"  No reading available: {fallback}")

        return result

    def _parse_variants(self):
        """Unihan_Variants.txt 파싱"""
        if not self.variants_path.exists():
            print(f"  Warning: Variants file not found")
            return

        with open(self.variants_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('#') or not line.strip():
                    continue

                parts = line.strip().split('\t')
                if len(parts) >= 3:
                    codepoint = parts[0]  # U+XXXX
                    field = parts[1]
                    value = parts[2]

                    if field == 'kTraditionalVariant':
                        try:
                            # U+XXXX 형식에서 한자 추출
                            simplified = chr(int(codepoint[2:], 16))
                            # 첫 번째 전통 한자만 사용
                            trad_cp = value.split()[0]
                            traditional = chr(int(trad_cp[2:], 16))
                            self.traditional_variants[simplified] = traditional
                        except (ValueError, IndexError):
                            pass

        print(f"  Traditional variants loaded: {len(self.traditional_variants)}")

    def _parse_readings(self):
        """Unihan_Readings.txt 파싱"""
        if not self.readings_path.exists():
            raise FileNotFoundError(f"Unihan Readings not found: {self.readings_path}")

        with open(self.readings_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('#') or not line.strip():
                    continue

                parts = line.strip().split('\t')
                if len(parts) >= 3:
                    codepoint = parts[0]  # U+XXXX
                    field = parts[1]
                    value = parts[2]

                    if field == 'kHangul':
                        try:
                            kanji = chr(int(codepoint[2:], 16))
                            # 첫 번째 독음만 사용 (콜론 이전 부분)
                            reading = value.split(':')[0].strip()
                            self.hangul_readings[kanji] = reading
                        except (ValueError, IndexError):
                            pass

        print(f"  Hangul readings loaded: {len(self.hangul_readings)}")

    def _get_korean_reading(self, kanji: str) -> Optional[str]:
        """한자의 한국어 독음 반환"""
        # 직접 매핑 확인
        if kanji in self.hangul_readings:
            return self.hangul_readings[kanji]

        # 신자체인 경우 전통 한자로 변환 후 검색
        if kanji in self.traditional_variants:
            traditional = self.traditional_variants[kanji]
            if traditional in self.hangul_readings:
                return self.hangul_readings[traditional]

        return None


class JLPTMapper:
    """JLPT 등급 매퍼"""

    def __init__(self, mapping_path: Path):
        self.mapping_path = mapping_path
        self.kanji_to_level: Dict[str, str] = {}

    def load(self) -> Dict[str, str]:
        """JLPT 매핑 로드"""
        print("\n[4/5] JLPT 매핑 로드")
        print("-" * 40)

        if not self.mapping_path.exists():
            print("  Warning: JLPT mapping not found, all kanji will be N1")
            return {}

        with open(self.mapping_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        for level, kanji_list in data.items():
            for kanji in kanji_list:
                self.kanji_to_level[kanji] = level

        stats = {level: len(kanji_list) for level, kanji_list in data.items()}
        print(f"  JLPT mapping: {stats}")

        return self.kanji_to_level

    def get_level(self, kanji: str) -> str:
        """한자의 JLPT 등급 반환 (기본값: N1)"""
        return self.kanji_to_level.get(kanji, 'N1')


class KoreanHuneumMapper:
    """한국어 훈음 매퍼"""

    def __init__(self, huneum_path: Path):
        self.huneum_path = huneum_path
        self.huneum_data: Dict[str, str] = {}

    def load(self) -> Dict[str, str]:
        """훈음 데이터 로드"""
        if not self.huneum_path.exists():
            return {}

        with open(self.huneum_path, 'r', encoding='utf-8') as f:
            self.huneum_data = json.load(f)

        return self.huneum_data

    def get_huneum(self, kanji: str, unihan_reading: Optional[str] = None) -> Optional[str]:
        """한자의 훈음 반환"""
        # 직접 매핑 확인
        if kanji in self.huneum_data:
            return self.huneum_data[kanji]

        # Unihan 독음으로 fallback
        if unihan_reading:
            return f"[- {unihan_reading}]"

        return None


class DatabaseBuilder:
    """SQLite 데이터베이스 빌더"""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.conn: Optional[sqlite3.Connection] = None

    def connect(self):
        """데이터베이스 연결"""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.db_path)

    def close(self):
        """연결 종료"""
        if self.conn:
            self.conn.close()

    def create_schema(self):
        """테이블 스키마 생성"""
        cursor = self.conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS kanji (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                literal TEXT NOT NULL UNIQUE,
                unicode_hex TEXT NOT NULL,
                grade INTEGER NOT NULL,
                jlpt_level TEXT NOT NULL,
                stroke_count INTEGER NOT NULL,
                radical INTEGER,
                frequency INTEGER,
                korean_hun_eum TEXT,
                ja_on TEXT NOT NULL,
                ja_kun TEXT NOT NULL,
                meanings_en TEXT NOT NULL,
                stroke_paths TEXT NOT NULL
            )
        ''')

        # 인덱스 생성
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_kanji_grade ON kanji(grade)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_kanji_jlpt ON kanji(jlpt_level)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_kanji_literal ON kanji(literal)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_kanji_stroke ON kanji(stroke_count)')

        self.conn.commit()

    def insert_kanji(self, kanji_list: List[dict]):
        """한자 데이터 삽입"""
        cursor = self.conn.cursor()

        for kanji in progress_bar(kanji_list, desc="Inserting"):
            cursor.execute('''
                INSERT OR REPLACE INTO kanji (
                    literal, unicode_hex, grade, jlpt_level, stroke_count,
                    radical, frequency, korean_hun_eum, ja_on, ja_kun,
                    meanings_en, stroke_paths
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                kanji['literal'],
                kanji['unicode_hex'],
                kanji['grade'],
                kanji['jlpt_level'],
                kanji['stroke_count'],
                kanji.get('radical'),
                kanji.get('frequency'),
                kanji.get('korean_hun_eum'),
                json.dumps(kanji['ja_on'], ensure_ascii=False),
                json.dumps(kanji['ja_kun'], ensure_ascii=False),
                json.dumps(kanji['meanings_en'], ensure_ascii=False),
                json.dumps(kanji['stroke_paths'], ensure_ascii=False)
            ))

        self.conn.commit()


def build_database():
    """메인 빌드 프로세스"""
    print("=" * 50)
    print("kanji-db-builder: 데이터베이스 빌드")
    print("=" * 50)

    # 1. KANJIDIC2 파싱
    kanjidic_parser = KanjiDictParser(KANJIDIC2_PATH)
    kanji_data = kanjidic_parser.parse()

    target_kanji = set(kanji_data.keys())
    print(f"  Target kanji count: {len(target_kanji)}")

    # 2. KanjiVG 파싱
    kanjivg_parser = KanjiVGParser(KANJIVG_PATH)
    stroke_data = kanjivg_parser.parse(target_kanji)

    # 3. Unihan 파싱
    unihan_parser = UnihanParser(UNIHAN_READINGS_PATH, UNIHAN_VARIANTS_PATH)
    korean_readings = unihan_parser.parse(target_kanji)

    # 4. JLPT 매핑 로드
    jlpt_mapper = JLPTMapper(JLPT_MAPPING_PATH)
    jlpt_mapper.load()

    # 5. 한국어 훈음 로드
    huneum_mapper = KoreanHuneumMapper(KOREAN_HUNEUM_PATH)
    huneum_mapper.load()

    # 데이터 결합
    print("\n[5/5] 데이터 결합 및 저장")
    print("-" * 40)

    combined_kanji = []

    for literal, data in kanji_data.items():
        # 획순 데이터
        strokes = stroke_data.get(literal, [])

        # JLPT 등급
        jlpt_level = jlpt_mapper.get_level(literal)

        # 한국어 훈음
        unihan_reading = korean_readings.get(literal)
        korean_hun_eum = huneum_mapper.get_huneum(literal, unihan_reading)

        combined = {
            'literal': literal,
            'unicode_hex': data['unicode_hex'],
            'grade': data['grade'],
            'jlpt_level': jlpt_level,
            'stroke_count': data['stroke_count'],
            'radical': data.get('radical'),
            'frequency': data.get('frequency'),
            'korean_hun_eum': korean_hun_eum,
            'ja_on': data['ja_on'],
            'ja_kun': data['ja_kun'],
            'meanings_en': data['meanings_en'],
            'stroke_paths': strokes
        }

        combined_kanji.append(combined)

    # 학년 → JLPT → 빈도 순 정렬
    combined_kanji.sort(key=lambda x: (
        x['grade'],
        {'N5': 1, 'N4': 2, 'N3': 3, 'N2': 4, 'N1': 5}.get(x['jlpt_level'], 5),
        x.get('frequency') or 9999
    ))

    # SQLite 저장
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    db_builder = DatabaseBuilder(OUTPUT_DB_PATH)
    db_builder.connect()
    db_builder.create_schema()
    db_builder.insert_kanji(combined_kanji)
    db_builder.close()

    print(f"  SQLite saved: {OUTPUT_DB_PATH}")
    print(f"  Total records: {len(combined_kanji)}")

    # JSON 저장
    json_output = {
        'version': '1.0.0',
        'total_count': len(combined_kanji),
        'kanji': combined_kanji
    }

    with open(OUTPUT_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(json_output, f, ensure_ascii=False, indent=2)

    print(f"  JSON saved: {OUTPUT_JSON_PATH}")

    # 통계
    print("\n" + "=" * 50)
    print("빌드 완료 통계")
    print("=" * 50)

    # 학년별 통계
    grade_stats = {}
    for k in combined_kanji:
        g = k['grade']
        grade_stats[g] = grade_stats.get(g, 0) + 1

    print("\n  [학년별 분포]")
    for g in sorted(grade_stats.keys()):
        print(f"    Grade {g}: {grade_stats[g]}자")

    # JLPT별 통계
    jlpt_stats = {}
    for k in combined_kanji:
        j = k['jlpt_level']
        jlpt_stats[j] = jlpt_stats.get(j, 0) + 1

    print("\n  [JLPT별 분포]")
    for j in ['N5', 'N4', 'N3', 'N2', 'N1']:
        print(f"    {j}: {jlpt_stats.get(j, 0)}자")

    # 획순 데이터 유무
    with_strokes = sum(1 for k in combined_kanji if k['stroke_paths'])
    print(f"\n  [획순 데이터]")
    print(f"    With strokes: {with_strokes}자")
    print(f"    Without strokes: {len(combined_kanji) - with_strokes}자")

    # 한국어 훈음
    with_korean = sum(1 for k in combined_kanji if k.get('korean_hun_eum'))
    print(f"\n  [한국어 훈음]")
    print(f"    With huneum: {with_korean}자")
    print(f"    Without huneum: {len(combined_kanji) - with_korean}자")

    print("\n빌드 완료!")

    return 0


if __name__ == "__main__":
    exit(build_database())
