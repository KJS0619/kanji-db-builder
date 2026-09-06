# kanji-db-builder

일본어 상용 한자(常用漢字, 2,136자) 학습 앱을 위한 로컬 데이터베이스(SQLite/JSON) 구축 ETL 파이프라인

## 개요

외부 상용 API나 저작권 데이터를 사용하지 않고, **100% 퍼블릭 도메인 및 오픈소스 데이터**만을 결합하여 완성도 높은 `kanji_master.db` (SQLite)와 `kanji_master.json` 파일을 자동 생성합니다.

## 데이터 소스

| 소스 | 용도 | 라이선스 |
|------|------|----------|
| [KANJIDIC2](http://www.edrdg.org/wiki/index.php/KANJIDIC_Project) | 한자 메타데이터 (음훈독, 획수, 등급) | CC BY-SA 3.0 |
| [KanjiVG](https://kanjivg.tagaini.net/) | 획순 SVG 벡터 데이터 | CC BY-SA 3.0 |
| [Unihan Database](https://www.unicode.org/charts/unihan.html) | 한국어 독음, 신자체/정자체 매핑 | Unicode ToS |
| JLPT 매핑 | 신 JLPT N1~N5 등급 | 공개 데이터 |

## 디렉터리 구조

```
kanji-db-builder/
├── scripts/
│   ├── download_data.py    # 원천 데이터 다운로드
│   └── build_db.py         # SQLite/JSON 빌드
├── data/
│   ├── raw/                # 원천 데이터 (.gitignore)
│   └── output/             # 최종 산출물
│       ├── kanji_master.db
│       └── kanji_master.json
├── requirements.txt
└── README.md
```

## 설치 및 실행

```bash
# 1. 의존성 설치
pip install -r requirements.txt

# 2. 원천 데이터 다운로드
python scripts/download_data.py

# 3. 데이터베이스 빌드
python scripts/build_db.py
```

## 출력 스키마

### SQLite (kanji_master.db)

```sql
CREATE TABLE kanji (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    literal TEXT NOT NULL UNIQUE,     -- 한자 문자 (예: '水')
    unicode_hex TEXT NOT NULL,        -- 5자리 hex (예: '06c34')
    grade INTEGER NOT NULL,           -- 학년 배당 (1~6, 8)
    jlpt_level TEXT NOT NULL,         -- JLPT 등급 ('N5'~'N1')
    stroke_count INTEGER NOT NULL,    -- 획수
    radical INTEGER,                  -- 부수 번호
    frequency INTEGER,                -- 신문 빈도 순위
    korean_hun_eum TEXT,              -- 한국어 훈음 ('물 수')
    ja_on TEXT NOT NULL,              -- 음독 JSON (["スイ"])
    ja_kun TEXT NOT NULL,             -- 훈독 JSON (["みず"])
    meanings_en TEXT NOT NULL,        -- 영문 의미 JSON
    stroke_paths TEXT NOT NULL        -- 획순 JSON
);
```

### stroke_paths 구조

```json
[
  {"order": 1, "path": "M36.25,15.38...", "start_x": 36.25, "start_y": 15.38},
  {"order": 2, "path": "M50.12,25.75...", "start_x": 50.12, "start_y": 25.75}
]
```

### JSON (kanji_master.json)

```json
{
  "version": "1.0.0",
  "total_count": 2136,
  "kanji": [
    {
      "literal": "水",
      "unicode_hex": "06c34",
      "grade": 1,
      "jlpt_level": "N5",
      "stroke_count": 4,
      "radical": 85,
      "frequency": 223,
      "korean_hun_eum": "물 수",
      "ja_on": ["スイ"],
      "ja_kun": ["みず"],
      "meanings_en": ["water"],
      "stroke_paths": [...]
    }
  ]
}
```

## 학년(Grade) 설명

| Grade | 설명 | 자수 |
|-------|------|------|
| 1 | 소학교 1학년 | 80 |
| 2 | 소학교 2학년 | 160 |
| 3 | 소학교 3학년 | 200 |
| 4 | 소학교 4학년 | 202 |
| 5 | 소학교 5학년 | 193 |
| 6 | 소학교 6학년 | 191 |
| 8 | 중학교 이상 | ~1,110 |

**총 상용 한자: 2,136자**

## 신 JLPT 등급

| Level | 대략적 자수 |
|-------|------------|
| N5 | ~80자 |
| N4 | ~170자 |
| N3 | ~370자 |
| N2 | ~380자 |
| N1 | 나머지 (~1,100자) |

## 한국어 훈음 매핑

- **직접 매핑**: 주요 상용 한자 300+자에 대해 "훈 음" 형식 제공
- **Unihan fallback**: 매핑 없는 경우 `[- 음]` 형식 (예: `[- 수]`)
- **신자체 처리**: 일본 신자체 → 한국 정자체 변환 후 독음 검색

## 라이선스

이 프로젝트의 코드는 MIT 라이선스입니다.

생성된 데이터베이스는 원천 데이터의 라이선스를 따릅니다:
- KANJIDIC2, KanjiVG: CC BY-SA 3.0
- Unihan: Unicode Terms of Use

## 기여

이슈 및 PR 환영합니다.
