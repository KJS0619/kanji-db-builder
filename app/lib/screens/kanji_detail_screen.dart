import 'package:flutter/material.dart';

import '../models/kanji.dart';
import '../widgets/stroke_animation_view.dart';

/// 한자 상세 화면
class KanjiDetailScreen extends StatelessWidget {
  final Kanji kanji;

  const KanjiDetailScreen({
    super.key,
    required this.kanji,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(kanji.literal),
        actions: [
          // 즐겨찾기 버튼 (TODO)
          IconButton(
            icon: const Icon(Icons.star_border),
            onPressed: () {},
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // 한자 헤더
            _buildKanjiHeader(context),

            // 획순 애니메이션
            _buildStrokeSection(context),

            // 읽기 정보
            _buildReadingsSection(context),

            // 메타 정보
            _buildMetaSection(context),

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildKanjiHeader(BuildContext context) {
    final jlptColor = Color(kanji.jlptColorValue);

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Theme.of(context).colorScheme.primaryContainer,
            Theme.of(context).colorScheme.primaryContainer.withOpacity(0.3),
          ],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Column(
        children: [
          // 한자
          Container(
            width: 120,
            height: 120,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Center(
              child: Text(
                kanji.literal,
                style: const TextStyle(
                  fontSize: 72,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // 배지들
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: [
              // JLPT 배지
              _Badge(
                label: kanji.jlptLevel,
                color: jlptColor,
              ),
              // 학년 배지
              _Badge(
                label: kanji.gradeDisplay,
                color: Theme.of(context).colorScheme.secondary,
              ),
              // 획수 배지
              _Badge(
                label: '${kanji.strokeCount}획',
                color: Theme.of(context).colorScheme.tertiary,
              ),
              // 빈도 (있으면)
              if (kanji.frequency != null)
                _Badge(
                  label: '#${kanji.frequency}',
                  color: Colors.grey,
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStrokeSection(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.brush, size: 20),
              const SizedBox(width: 8),
              Text(
                '획순 (${kanji.strokeCount}획)',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 획순 애니메이션 뷰
          if (kanji.strokePaths.isNotEmpty)
            StrokeAnimationView(
              kanji: kanji,
              size: 200,
            )
          else
            Container(
              height: 200,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceVariant,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.not_interested,
                      size: 48,
                      color: Theme.of(context)
                          .colorScheme
                          .onSurfaceVariant
                          .withOpacity(0.5),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '획순 데이터 없음',
                      style: TextStyle(
                        color: Theme.of(context)
                            .colorScheme
                            .onSurfaceVariant
                            .withOpacity(0.7),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildReadingsSection(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.record_voice_over, size: 20),
              const SizedBox(width: 8),
              Text(
                '읽기',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 음독
          if (kanji.jaOn.isNotEmpty)
            _ReadingCard(
              label: '音読み (온요미)',
              value: kanji.onReadings,
              color: Colors.blue,
            ),

          // 훈독
          if (kanji.jaKun.isNotEmpty)
            _ReadingCard(
              label: '訓読み (쿤요미)',
              value: kanji.kunReadings,
              color: Colors.green,
            ),

          // 한국어 훈음
          if (kanji.koreanHunEum != null)
            _ReadingCard(
              label: '한국어 훈음',
              value: kanji.koreanHunEum!,
              color: Colors.orange,
            ),

          // 영문 의미
          if (kanji.meaningsEn.isNotEmpty)
            _ReadingCard(
              label: 'English',
              value: kanji.meanings,
              color: Colors.purple,
            ),
        ],
      ),
    );
  }

  Widget _buildMetaSection(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.info_outline, size: 20),
              const SizedBox(width: 8),
              Text(
                '상세 정보',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _MetaRow(
                    label: 'Unicode',
                    value: 'U+${kanji.unicodeHex.toUpperCase()}',
                  ),
                  _MetaRow(
                    label: 'JLPT',
                    value: kanji.jlptLevel,
                  ),
                  _MetaRow(
                    label: '학년 배당',
                    value: kanji.grade <= 6
                        ? '소학교 ${kanji.grade}학년'
                        : '중학교 이상',
                  ),
                  _MetaRow(
                    label: '획수',
                    value: '${kanji.strokeCount}획',
                  ),
                  if (kanji.radical != null)
                    _MetaRow(
                      label: '부수 번호',
                      value: '${kanji.radical}',
                    ),
                  if (kanji.frequency != null)
                    _MetaRow(
                      label: '빈도 순위',
                      value: '${kanji.frequency}위',
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 배지 위젯
class _Badge extends StatelessWidget {
  final String label;
  final Color color;

  const _Badge({
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: color.withOpacity(0.3),
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.bold,
          fontSize: 13,
        ),
      ),
    );
  }
}

/// 읽기 카드 위젯
class _ReadingCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _ReadingCard({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 4,
              height: 40,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: color,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    value,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 메타 정보 행
class _MetaRow extends StatelessWidget {
  final String label;
  final String value;

  const _MetaRow({
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context)
                      .colorScheme
                      .onSurface
                      .withOpacity(0.7),
                ),
          ),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
        ],
      ),
    );
  }
}
