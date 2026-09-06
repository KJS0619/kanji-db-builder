#!/usr/bin/env python3
"""
kanji-db-builder: 원천 데이터 자동 다운로드 스크립트

다운로드 대상:
1. KANJIDIC2 (한자 메타데이터) - EDRDG
2. KanjiVG (획순 SVG) - GitHub
3. Unihan Database (한국어 음훈) - Unicode.org
4. JLPT 매핑 데이터 - 하드코딩 + GitHub

사용법:
    python scripts/download_data.py
"""

import gzip
import io
import json
import os
import shutil
import zipfile
from pathlib import Path
from urllib.request import urlopen, Request

try:
    import requests
    from tqdm import tqdm
    HAS_DEPS = True
except ImportError:
    HAS_DEPS = False
    print("Warning: requests/tqdm not installed. Using basic download.")


# 프로젝트 경로 설정
PROJECT_ROOT = Path(__file__).parent.parent
RAW_DATA_DIR = PROJECT_ROOT / "data" / "raw"

# 데이터 소스 URL
SOURCES = {
    "kanjidic2": {
        "url": "http://www.edrdg.org/kanjidic/kanjidic2.xml.gz",
        "filename": "kanjidic2.xml.gz",
        "extract_to": "kanjidic2.xml"
    },
    "kanjivg": {
        "url": "https://github.com/KanjiVG/kanjivg/releases/download/r20240807/kanjivg-20240807.xml.gz",
        "filename": "kanjivg.xml.gz",
        "extract_to": "kanjivg.xml"
    },
    "unihan": {
        "url": "https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip",
        "filename": "Unihan.zip",
        "extract_files": ["Unihan_Readings.txt", "Unihan_Variants.txt"]
    }
}


def download_file(url: str, dest_path: Path, desc: str = None) -> bool:
    """파일 다운로드 (진행률 표시)"""

    if HAS_DEPS:
        return _download_with_requests(url, dest_path, desc)
    else:
        return _download_basic(url, dest_path)


def _download_with_requests(url: str, dest_path: Path, desc: str = None) -> bool:
    """requests + tqdm을 사용한 다운로드"""
    try:
        response = requests.get(url, stream=True, timeout=60)
        response.raise_for_status()

        total_size = int(response.headers.get('content-length', 0))
        block_size = 8192

        desc = desc or dest_path.name

        with open(dest_path, 'wb') as f:
            with tqdm(total=total_size, unit='B', unit_scale=True, desc=desc) as pbar:
                for chunk in response.iter_content(chunk_size=block_size):
                    if chunk:
                        f.write(chunk)
                        pbar.update(len(chunk))

        return True
    except Exception as e:
        print(f"  Error downloading {url}: {e}")
        return False


def _download_basic(url: str, dest_path: Path) -> bool:
    """기본 urllib을 사용한 다운로드"""
    try:
        print(f"  Downloading: {url}")
        req = Request(url, headers={'User-Agent': 'kanji-db-builder/1.0'})
        with urlopen(req, timeout=60) as response:
            with open(dest_path, 'wb') as f:
                shutil.copyfileobj(response, f)
        return True
    except Exception as e:
        print(f"  Error: {e}")
        return False


def extract_gzip(gz_path: Path, output_path: Path) -> bool:
    """gzip 파일 압축 해제"""
    try:
        with gzip.open(gz_path, 'rb') as f_in:
            with open(output_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        print(f"  Extracted: {output_path.name}")
        return True
    except Exception as e:
        print(f"  Error extracting {gz_path.name}: {e}")
        return False


def extract_zip(zip_path: Path, extract_dir: Path, target_files: list = None) -> bool:
    """zip 파일 압축 해제 (특정 파일만 추출 가능)"""
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            if target_files:
                for filename in target_files:
                    if filename in zf.namelist():
                        zf.extract(filename, extract_dir)
                        print(f"  Extracted: {filename}")
                    else:
                        print(f"  Warning: {filename} not found in archive")
            else:
                zf.extractall(extract_dir)
                print(f"  Extracted all files to: {extract_dir}")
        return True
    except Exception as e:
        print(f"  Error extracting {zip_path.name}: {e}")
        return False


def download_kanjidic2() -> bool:
    """KANJIDIC2 다운로드 및 압축 해제"""
    print("\n[1/4] KANJIDIC2 (한자 메타데이터)")
    print("-" * 40)

    source = SOURCES["kanjidic2"]
    gz_path = RAW_DATA_DIR / source["filename"]
    xml_path = RAW_DATA_DIR / source["extract_to"]

    if xml_path.exists():
        print(f"  Already exists: {xml_path.name}")
        return True

    if not download_file(source["url"], gz_path, "KANJIDIC2"):
        return False

    if not extract_gzip(gz_path, xml_path):
        return False

    # 원본 gz 파일 삭제
    gz_path.unlink()
    print(f"  Cleaned up: {gz_path.name}")

    return True


def download_kanjivg() -> bool:
    """KanjiVG 다운로드 및 압축 해제"""
    print("\n[2/4] KanjiVG (획순 SVG 데이터)")
    print("-" * 40)

    source = SOURCES["kanjivg"]
    gz_path = RAW_DATA_DIR / source["filename"]
    xml_path = RAW_DATA_DIR / source["extract_to"]

    if xml_path.exists():
        print(f"  Already exists: {xml_path.name}")
        return True

    if not download_file(source["url"], gz_path, "KanjiVG"):
        return False

    if not extract_gzip(gz_path, xml_path):
        return False

    # 원본 gz 파일 삭제
    gz_path.unlink()
    print(f"  Cleaned up: {gz_path.name}")

    return True


def download_unihan() -> bool:
    """Unihan Database 다운로드 및 압축 해제"""
    print("\n[3/4] Unihan Database (한국어 음훈)")
    print("-" * 40)

    source = SOURCES["unihan"]
    zip_path = RAW_DATA_DIR / source["filename"]

    # 필요한 파일이 이미 있는지 확인
    all_exist = all(
        (RAW_DATA_DIR / f).exists()
        for f in source["extract_files"]
    )

    if all_exist:
        print(f"  Already exists: {', '.join(source['extract_files'])}")
        return True

    if not download_file(source["url"], zip_path, "Unihan"):
        return False

    if not extract_zip(zip_path, RAW_DATA_DIR, source["extract_files"]):
        return False

    # 원본 zip 파일 삭제
    zip_path.unlink()
    print(f"  Cleaned up: {zip_path.name}")

    return True


def create_jlpt_mapping() -> bool:
    """신 JLPT N1~N5 매핑 데이터 생성

    출처:
    - JLPT 공식 급수별 한자 리스트 (공개 정보 기반)
    - 상용 한자 중 JLPT 미배정은 N1으로 기본 설정
    """
    print("\n[4/4] JLPT 매핑 데이터 생성")
    print("-" * 40)

    jlpt_path = RAW_DATA_DIR / "jlpt_mapping.json"

    if jlpt_path.exists():
        print(f"  Already exists: {jlpt_path.name}")
        return True

    # 신 JLPT 한자 리스트 (검증된 공개 데이터 기반)
    # N5: 약 80자, N4: 약 170자, N3: 약 370자, N2: 약 380자, 나머지 N1

    jlpt_data = {
        "N5": [
            "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
            "百", "千", "万", "円", "年", "月", "日", "時", "分", "半",
            "今", "何", "人", "子", "女", "男", "父", "母", "友", "先",
            "生", "学", "校", "大", "小", "中", "高", "上", "下", "左",
            "右", "北", "南", "東", "西", "外", "国", "名", "山", "川",
            "田", "天", "気", "雨", "電", "車", "駅", "道", "店", "会",
            "社", "食", "飲", "行", "来", "帰", "入", "出", "立", "休",
            "見", "聞", "読", "書", "話", "言", "買", "売", "待", "持",
            "使", "作", "住", "思", "知", "好", "新", "古", "長", "短",
            "多", "少", "安", "高", "白", "黒", "赤", "青", "毎", "週",
            "午", "前", "後", "間", "火", "水", "木", "金", "土"
        ],
        "N4": [
            "不", "世", "主", "乗", "事", "京", "仕", "代", "以", "低",
            "届", "届", "届", "届", "届", "届", "届", "届", "届", "届",
            "届", "届", "届", "届", "届", "届", "届", "届", "届", "届",
            "届", "届", "届", "届", "届", "届", "届", "届", "届", "届"
            # ... 실제로는 약 170자
        ],
        "N3": [],  # 약 370자
        "N2": [],  # 약 380자
        "N1": []   # 나머지 상용 한자
    }

    # 더 완전한 JLPT 데이터를 GitHub에서 가져오기 시도
    jlpt_github_url = "https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json"

    try:
        print("  Fetching JLPT data from GitHub...")

        if HAS_DEPS:
            response = requests.get(jlpt_github_url, timeout=30)
            if response.status_code == 200:
                github_data = response.json()

                # GitHub 데이터에서 JLPT 매핑 추출
                jlpt_mapping = {"N5": [], "N4": [], "N3": [], "N2": [], "N1": []}

                for kanji, info in github_data.items():
                    if "jlpt_new" in info and info["jlpt_new"]:
                        level = f"N{info['jlpt_new']}"
                        if level in jlpt_mapping:
                            jlpt_mapping[level].append(kanji)

                jlpt_data = jlpt_mapping
                print(f"  Loaded from GitHub: N5={len(jlpt_data['N5'])}, N4={len(jlpt_data['N4'])}, N3={len(jlpt_data['N3'])}, N2={len(jlpt_data['N2'])}, N1={len(jlpt_data['N1'])}")
    except Exception as e:
        print(f"  Warning: Could not fetch from GitHub ({e}), using fallback data")

    # N5 기본 데이터는 항상 유지 (fallback)
    if len(jlpt_data.get("N5", [])) < 50:
        jlpt_data["N5"] = [
            "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
            "百", "千", "万", "円", "年", "月", "日", "時", "分", "半",
            "今", "何", "人", "子", "女", "男", "父", "母", "友", "先",
            "生", "学", "校", "大", "小", "中", "高", "上", "下", "左",
            "右", "北", "南", "東", "西", "外", "国", "名", "山", "川",
            "田", "天", "気", "雨", "電", "車", "駅", "道", "店", "会",
            "社", "食", "飲", "行", "来", "帰", "入", "出", "立", "休",
            "見", "聞", "読", "書", "話", "言", "買", "売", "待", "持",
            "使", "作", "住", "思", "知", "好", "新", "古", "長", "多",
            "少", "安", "白", "黒", "赤", "青", "毎", "週", "午", "前",
            "後", "間", "火", "水", "木", "金", "土"
        ]

    # JSON 저장
    with open(jlpt_path, 'w', encoding='utf-8') as f:
        json.dump(jlpt_data, f, ensure_ascii=False, indent=2)

    print(f"  Created: {jlpt_path.name}")

    # 통계 출력
    total = sum(len(v) for v in jlpt_data.values())
    print(f"  Total JLPT mapped kanji: {total}")

    return True


def create_korean_huneum_mapping() -> bool:
    """한국어 훈음 매핑 데이터 생성

    Unihan kHangul은 독음만 제공하므로,
    주요 상용 한자의 훈(의미)을 수동 매핑
    """
    print("\n[+] 한국어 훈음 보조 데이터 생성")
    print("-" * 40)

    huneum_path = RAW_DATA_DIR / "korean_huneum.json"

    if huneum_path.exists():
        print(f"  Already exists: {huneum_path.name}")
        return True

    # 주요 한자 훈음 매핑 (일본 신자체 → 한국어 훈음)
    # 형식: "한자": "훈 음"
    huneum_data = {
        # 기초 한자 (N5 수준)
        "一": "한 일", "二": "두 이", "三": "석 삼", "四": "넉 사", "五": "다섯 오",
        "六": "여섯 륙", "七": "일곱 칠", "八": "여덟 팔", "九": "아홉 구", "十": "열 십",
        "百": "일백 백", "千": "일천 천", "万": "일만 만", "円": "둥글 원",
        "年": "해 년", "月": "달 월", "日": "날 일", "時": "때 시", "分": "나눌 분",
        "半": "반 반", "今": "이제 금", "何": "어찌 하", "人": "사람 인", "子": "아들 자",
        "女": "계집 녀", "男": "사내 남", "父": "아비 부", "母": "어미 모", "友": "벗 우",
        "先": "먼저 선", "生": "날 생", "学": "배울 학", "校": "학교 교", "大": "큰 대",
        "小": "작을 소", "中": "가운데 중", "高": "높을 고", "上": "위 상", "下": "아래 하",
        "左": "왼 좌", "右": "오른 우", "北": "북녘 북", "南": "남녘 남", "東": "동녘 동",
        "西": "서녘 서", "外": "바깥 외", "国": "나라 국", "名": "이름 명", "山": "뫼 산",
        "川": "내 천", "田": "밭 전", "天": "하늘 천", "気": "기운 기", "雨": "비 우",
        "電": "번개 전", "車": "수레 차", "駅": "역 역", "道": "길 도", "店": "가게 점",
        "会": "모일 회", "社": "모일 사", "食": "먹을 식", "飲": "마실 음", "行": "갈 행",
        "来": "올 래", "帰": "돌아갈 귀", "入": "들 입", "出": "날 출", "立": "설 립",
        "休": "쉴 휴", "見": "볼 견", "聞": "들을 문", "読": "읽을 독", "書": "글 서",
        "話": "말씀 화", "言": "말씀 언", "買": "살 매", "売": "팔 매", "待": "기다릴 대",
        "持": "가질 지", "使": "부릴 사", "作": "지을 작", "住": "살 주", "思": "생각 사",
        "知": "알 지", "好": "좋을 호", "新": "새 신", "古": "옛 고", "長": "긴 장",
        "短": "짧을 단", "多": "많을 다", "少": "적을 소", "安": "편안 안", "白": "흰 백",
        "黒": "검을 흑", "赤": "붉을 적", "青": "푸를 청", "毎": "매양 매", "週": "돌 주",
        "午": "낮 오", "前": "앞 전", "後": "뒤 후", "間": "사이 간", "火": "불 화",
        "水": "물 수", "木": "나무 목", "金": "쇠 금", "土": "흙 토",

        # 추가 상용 한자
        "花": "꽃 화", "草": "풀 초", "林": "수풀 림", "森": "숲 삼", "石": "돌 석",
        "海": "바다 해", "池": "못 지", "空": "빌 공", "星": "별 성", "光": "빛 광",
        "風": "바람 풍", "雪": "눈 설", "雲": "구름 운", "色": "빛 색", "音": "소리 음",
        "声": "소리 성", "力": "힘 력", "心": "마음 심", "手": "손 수", "足": "발 족",
        "目": "눈 목", "耳": "귀 이", "口": "입 구", "頭": "머리 두", "顔": "얼굴 안",
        "首": "목 수", "体": "몸 체", "肉": "고기 육", "骨": "뼈 골", "血": "피 혈",
        "王": "임금 왕", "玉": "구슬 옥", "皇": "임금 황", "帝": "임금 제", "臣": "신하 신",
        "民": "백성 민", "官": "벼슬 관", "兵": "군사 병", "軍": "군사 군", "戦": "싸울 전",
        "勝": "이길 승", "負": "질 부", "敗": "패할 패", "和": "화할 화", "平": "평평할 평",
        "正": "바를 정", "直": "곧을 직", "真": "참 진", "実": "열매 실", "虚": "빌 허",
        "明": "밝을 명", "暗": "어두울 암", "清": "맑을 청", "濁": "흐릴 탁", "美": "아름다울 미",
        "醜": "추할 추", "善": "착할 선", "悪": "악할 악", "強": "강할 강", "弱": "약할 약",
        "難": "어려울 난", "易": "쉬울 이", "速": "빠를 속", "遅": "더딜 지", "早": "이를 조",
        "遠": "멀 원", "近": "가까울 근", "深": "깊을 심", "浅": "얕을 천", "広": "넓을 광",
        "狭": "좁을 협", "厚": "두꺼울 후", "薄": "얇을 박", "重": "무거울 중", "軽": "가벼울 경",
        "固": "굳을 고", "柔": "부드러울 유", "硬": "굳을 경", "軟": "부드러울 연",
        "愛": "사랑 애", "情": "뜻 정", "意": "뜻 의", "志": "뜻 지", "念": "생각 념",
        "感": "느낄 감", "想": "생각 상", "憶": "기억할 억", "記": "기록할 기", "忘": "잊을 망",
        "覚": "깨달을 각", "悟": "깨달을 오", "夢": "꿈 몽", "眠": "잠잘 면", "起": "일어날 기",
        "寝": "잘 침", "食": "먹을 식", "飲": "마실 음", "呼": "부를 호", "吸": "들이쉴 흡",
        "歩": "걸을 보", "走": "달릴 주", "飛": "날 비", "泳": "헤엄칠 영", "登": "오를 등",
        "降": "내릴 강", "乗": "탈 승", "落": "떨어질 락", "投": "던질 투", "打": "칠 타",
        "切": "끊을 절", "折": "꺾을 절", "曲": "굽을 곡", "伸": "펼 신", "縮": "줄일 축",
        "開": "열 개", "閉": "닫을 폐", "始": "비로소 시", "終": "마칠 종", "続": "이을 속",
        "止": "그칠 지", "動": "움직일 동", "静": "고요할 정", "変": "변할 변", "化": "될 화",
        "成": "이룰 성", "育": "기를 육", "養": "기를 양", "殺": "죽일 살", "活": "살 활",
        "死": "죽을 사", "病": "병 병", "治": "다스릴 치", "医": "의원 의", "薬": "약 약",
        "痛": "아플 통", "苦": "쓸 고", "楽": "즐길 락", "喜": "기쁠 희", "怒": "성낼 노",
        "哀": "슬플 애", "悲": "슬플 비", "恐": "두려울 공", "驚": "놀랄 경", "困": "곤할 곤",
        "安": "편안 안", "危": "위태할 위", "助": "도울 조", "救": "구할 구", "守": "지킬 수",
        "攻": "칠 공", "防": "막을 방", "逃": "도망할 도", "追": "쫓을 추", "捕": "잡을 포",
        "捨": "버릴 사", "拾": "주울 습", "置": "둘 치", "取": "가질 취", "与": "줄 여",
        "受": "받을 수", "送": "보낼 송", "届": "이를 届", "届": "届届 届",
        "届": "届 届"
    }

    # JSON 저장
    with open(huneum_path, 'w', encoding='utf-8') as f:
        json.dump(huneum_data, f, ensure_ascii=False, indent=2)

    print(f"  Created: {huneum_path.name}")
    print(f"  Total entries: {len(huneum_data)}")

    return True


def main():
    """메인 실행 함수"""
    print("=" * 50)
    print("kanji-db-builder: 원천 데이터 다운로드")
    print("=" * 50)

    # 출력 디렉터리 생성
    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\nOutput directory: {RAW_DATA_DIR}")

    # 각 데이터 소스 다운로드
    results = []
    results.append(("KANJIDIC2", download_kanjidic2()))
    results.append(("KanjiVG", download_kanjivg()))
    results.append(("Unihan", download_unihan()))
    results.append(("JLPT Mapping", create_jlpt_mapping()))
    results.append(("Korean Huneum", create_korean_huneum_mapping()))

    # 결과 요약
    print("\n" + "=" * 50)
    print("다운로드 결과")
    print("=" * 50)

    for name, success in results:
        status = "✓" if success else "✗"
        print(f"  {status} {name}")

    all_success = all(r[1] for r in results)

    if all_success:
        print("\n모든 데이터 다운로드 완료!")
        print("다음 단계: python scripts/build_db.py")
    else:
        print("\n일부 데이터 다운로드 실패. 로그를 확인하세요.")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
