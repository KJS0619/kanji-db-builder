import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/kanji.dart';
import '../services/database_service.dart';
import 'kanji_list_screen.dart';

/// 홈 화면 - JLPT 등급 선택
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, int> _kanjiCounts = {};
  int _totalCount = 0;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadCounts();
  }

  Future<void> _loadCounts() async {
    final db = context.read<DatabaseService>();
    final counts = await db.getKanjiCountByJlpt();
    final total = await db.getTotalKanjiCount();

    if (mounted) {
      setState(() {
        _kanjiCounts = counts;
        _totalCount = total;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('漢字マスター'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {
              // TODO: 검색 화면
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _buildContent(),
    );
  }

  Widget _buildContent() {
    return CustomScrollView(
      slivers: [
        // 헤더
        SliverToBoxAdapter(
          child: _buildHeader(),
        ),

        // JLPT 등급 카드
        SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final level = JlptLevel.all[index];
                final count = _kanjiCounts[level.level] ?? 0;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _JlptLevelCard(
                    level: level,
                    count: count,
                    onTap: () => _navigateToKanjiList(level),
                  ),
                );
              },
              childCount: JlptLevel.all.length,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Theme.of(context).colorScheme.primaryContainer,
            Theme.of(context).colorScheme.primaryContainer.withOpacity(0.5),
          ],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.menu_book,
            size: 64,
          ),
          const SizedBox(height: 16),
          Text(
            '常用漢字',
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            '총 $_totalCount자',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onPrimaryContainer,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            'JLPT 등급별 학습',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context)
                      .colorScheme
                      .onPrimaryContainer
                      .withOpacity(0.8),
                ),
          ),
        ],
      ),
    );
  }

  void _navigateToKanjiList(JlptLevel level) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => KanjiListScreen(jlptLevel: level),
      ),
    );
  }
}

/// JLPT 등급 카드 위젯
class _JlptLevelCard extends StatelessWidget {
  final JlptLevel level;
  final int count;
  final VoidCallback onTap;

  const _JlptLevelCard({
    required this.level,
    required this.count,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = Color(level.colorValue);

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border(
              left: BorderSide(
                color: color,
                width: 4,
              ),
            ),
          ),
          child: Row(
            children: [
              // JLPT 배지
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    level.level,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: color,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),

              // 정보
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      level.name,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      level.description,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context)
                                .colorScheme
                                .onSurface
                                .withOpacity(0.7),
                          ),
                    ),
                  ],
                ),
              ),

              // 개수 및 화살표
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '$count자',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: color,
                        ),
                  ),
                  Icon(
                    Icons.arrow_forward_ios,
                    size: 16,
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withOpacity(0.5),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
