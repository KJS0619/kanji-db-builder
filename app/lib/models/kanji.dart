import 'dart:convert';

/// 한자 데이터 모델
class Kanji {
  final int id;
  final String literal;
  final String unicodeHex;
  final int grade;
  final String jlptLevel;
  final int strokeCount;
  final int? radical;
  final int? frequency;
  final String? koreanHunEum;
  final List<String> jaOn;
  final List<String> jaKun;
  final List<String> meaningsEn;
  final List<StrokePath> strokePaths;

  Kanji({
    required this.id,
    required this.literal,
    required this.unicodeHex,
    required this.grade,
    required this.jlptLevel,
    required this.strokeCount,
    this.radical,
    this.frequency,
    this.koreanHunEum,
    required this.jaOn,
    required this.jaKun,
    required this.meaningsEn,
    required this.strokePaths,
  });

  /// SQLite 행에서 Kanji 객체 생성
  factory Kanji.fromMap(Map<String, dynamic> map) {
    // JSON 문자열을 List로 파싱
    List<String> parseJsonList(String? jsonStr) {
      if (jsonStr == null || jsonStr.isEmpty) return [];
      try {
        final decoded = json.decode(jsonStr);
        if (decoded is List) {
          return decoded.map((e) => e.toString()).toList();
        }
      } catch (_) {}
      return [];
    }

    // stroke_paths JSON 파싱
    List<StrokePath> parseStrokePaths(String? jsonStr) {
      if (jsonStr == null || jsonStr.isEmpty) return [];
      try {
        final decoded = json.decode(jsonStr);
        if (decoded is List) {
          return decoded
              .map((e) => StrokePath.fromMap(e as Map<String, dynamic>))
              .toList();
        }
      } catch (_) {}
      return [];
    }

    return Kanji(
      id: map['id'] as int,
      literal: map['literal'] as String,
      unicodeHex: map['unicode_hex'] as String,
      grade: map['grade'] as int,
      jlptLevel: map['jlpt_level'] as String,
      strokeCount: map['stroke_count'] as int,
      radical: map['radical'] as int?,
      frequency: map['frequency'] as int?,
      koreanHunEum: map['korean_hun_eum'] as String?,
      jaOn: parseJsonList(map['ja_on'] as String?),
      jaKun: parseJsonList(map['ja_kun'] as String?),
      meaningsEn: parseJsonList(map['meanings_en'] as String?),
      strokePaths: parseStrokePaths(map['stroke_paths'] as String?),
    );
  }

  /// 음독 문자열 (콤마 구분)
  String get onReadings => jaOn.join(', ');

  /// 훈독 문자열 (콤마 구분)
  String get kunReadings => jaKun.join(', ');

  /// 영문 의미 문자열
  String get meanings => meaningsEn.join(', ');

  /// 학년 표시 문자열
  String get gradeDisplay {
    if (grade <= 6) {
      return '小$grade';
    } else if (grade == 8) {
      return '中学';
    }
    return 'G$grade';
  }

  /// JLPT 색상
  int get jlptColorValue {
    switch (jlptLevel) {
      case 'N5':
        return 0xFF4CAF50; // 녹색
      case 'N4':
        return 0xFF8BC34A; // 연두
      case 'N3':
        return 0xFFFFC107; // 노랑
      case 'N2':
        return 0xFFFF9800; // 주황
      case 'N1':
        return 0xFFF44336; // 빨강
      default:
        return 0xFF9E9E9E;
    }
  }
}

/// 획 경로 데이터
class StrokePath {
  final int order;
  final String path;
  final double startX;
  final double startY;

  StrokePath({
    required this.order,
    required this.path,
    required this.startX,
    required this.startY,
  });

  factory StrokePath.fromMap(Map<String, dynamic> map) {
    return StrokePath(
      order: map['order'] as int? ?? 0,
      path: map['path'] as String? ?? '',
      startX: (map['start_x'] as num?)?.toDouble() ?? 0.0,
      startY: (map['start_y'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

/// JLPT 등급 정보
class JlptLevel {
  final String level;
  final String name;
  final String description;
  final int colorValue;

  const JlptLevel({
    required this.level,
    required this.name,
    required this.description,
    required this.colorValue,
  });

  static const List<JlptLevel> all = [
    JlptLevel(
      level: 'N5',
      name: 'N5 (입문)',
      description: '기초 한자 약 80자',
      colorValue: 0xFF4CAF50,
    ),
    JlptLevel(
      level: 'N4',
      name: 'N4 (초급)',
      description: '기초 한자 약 170자',
      colorValue: 0xFF8BC34A,
    ),
    JlptLevel(
      level: 'N3',
      name: 'N3 (중급)',
      description: '중급 한자 약 370자',
      colorValue: 0xFFFFC107,
    ),
    JlptLevel(
      level: 'N2',
      name: 'N2 (중상급)',
      description: '중상급 한자 약 380자',
      colorValue: 0xFFFF9800,
    ),
    JlptLevel(
      level: 'N1',
      name: 'N1 (상급)',
      description: '상급 한자 약 1,100자',
      colorValue: 0xFFF44336,
    ),
  ];
}
