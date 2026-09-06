import 'dart:io';

import 'package:flutter/services.dart';
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

import '../models/kanji.dart';

/// SQLite 데이터베이스 서비스
class DatabaseService {
  static const String _dbName = 'kanji_master.db';
  static const String _assetPath = 'assets/db/kanji_master.db';

  Database? _database;

  /// 데이터베이스 초기화
  Future<void> initialize() async {
    if (_database != null) return;

    final documentsDirectory = await getApplicationDocumentsDirectory();
    final dbPath = join(documentsDirectory.path, _dbName);

    // 데이터베이스 파일이 없으면 assets에서 복사
    final exists = await File(dbPath).exists();
    if (!exists) {
      await _copyDatabaseFromAssets(dbPath);
    }

    _database = await openDatabase(dbPath, readOnly: true);
  }

  /// Assets에서 데이터베이스 파일 복사
  Future<void> _copyDatabaseFromAssets(String dbPath) async {
    try {
      // assets에서 바이트 데이터 로드
      final data = await rootBundle.load(_assetPath);
      final bytes = data.buffer.asUint8List();

      // 파일로 저장
      await File(dbPath).writeAsBytes(bytes, flush: true);
    } catch (e) {
      throw Exception('Failed to copy database from assets: $e');
    }
  }

  /// 데이터베이스 인스턴스
  Database get db {
    if (_database == null) {
      throw StateError('Database not initialized. Call initialize() first.');
    }
    return _database!;
  }

  /// JLPT 등급별 한자 개수 조회
  Future<Map<String, int>> getKanjiCountByJlpt() async {
    final results = await db.rawQuery('''
      SELECT jlpt_level, COUNT(*) as count
      FROM kanji
      GROUP BY jlpt_level
      ORDER BY jlpt_level DESC
    ''');

    final counts = <String, int>{};
    for (final row in results) {
      final level = row['jlpt_level'] as String;
      final count = row['count'] as int;
      counts[level] = count;
    }

    return counts;
  }

  /// JLPT 등급별 한자 목록 조회
  Future<List<Kanji>> getKanjiByJlpt(String jlptLevel) async {
    final results = await db.query(
      'kanji',
      where: 'jlpt_level = ?',
      whereArgs: [jlptLevel],
      orderBy: 'grade ASC, frequency ASC',
    );

    return results.map((row) => Kanji.fromMap(row)).toList();
  }

  /// 학년별 한자 목록 조회
  Future<List<Kanji>> getKanjiByGrade(int grade) async {
    final results = await db.query(
      'kanji',
      where: 'grade = ?',
      whereArgs: [grade],
      orderBy: 'frequency ASC',
    );

    return results.map((row) => Kanji.fromMap(row)).toList();
  }

  /// 한자 검색 (리터럴, 음독, 훈독, 한국어 훈음)
  Future<List<Kanji>> searchKanji(String query) async {
    if (query.isEmpty) return [];

    final results = await db.rawQuery('''
      SELECT * FROM kanji
      WHERE literal LIKE ?
         OR ja_on LIKE ?
         OR ja_kun LIKE ?
         OR korean_hun_eum LIKE ?
         OR meanings_en LIKE ?
      ORDER BY grade ASC, frequency ASC
      LIMIT 100
    ''', [
      '%$query%',
      '%$query%',
      '%$query%',
      '%$query%',
      '%$query%',
    ]);

    return results.map((row) => Kanji.fromMap(row)).toList();
  }

  /// 단일 한자 조회
  Future<Kanji?> getKanjiByLiteral(String literal) async {
    final results = await db.query(
      'kanji',
      where: 'literal = ?',
      whereArgs: [literal],
      limit: 1,
    );

    if (results.isEmpty) return null;
    return Kanji.fromMap(results.first);
  }

  /// ID로 한자 조회
  Future<Kanji?> getKanjiById(int id) async {
    final results = await db.query(
      'kanji',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );

    if (results.isEmpty) return null;
    return Kanji.fromMap(results.first);
  }

  /// 전체 한자 수
  Future<int> getTotalKanjiCount() async {
    final result = await db.rawQuery('SELECT COUNT(*) as count FROM kanji');
    return result.first['count'] as int;
  }

  /// 데이터베이스 종료
  Future<void> close() async {
    await _database?.close();
    _database = null;
  }
}
