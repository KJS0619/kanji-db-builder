import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/kanji.dart';
import '../services/database_service.dart';
import '../widgets/kanji_grid_tile.dart';
import 'kanji_detail_screen.dart';

/// JLPT 등급별 한자 목록 화면
class KanjiListScreen extends StatefulWidget {
  final JlptLevel jlptLevel;

  const KanjiListScreen({
    super.key,
    required this.jlptLevel,
  });

  @override
  State<KanjiListScreen> createState() => _KanjiListScreenState();
}

class _KanjiListScreenState extends State<KanjiListScreen> {
  List<Kanji> _kanjiList = [];
  bool _isLoading = true;
  bool _isGridView = true;

  @override
  void initState() {
    super.initState();
    _loadKanji();
  }

  Future<void> _loadKanji() async {
    final db = context.read<DatabaseService>();
    final list = await db.getKanjiByJlpt(widget.jlptLevel.level);

    if (mounted) {
      setState(() {
        _kanjiList = list;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = Color(widget.jlptLevel.colorValue);

    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.jlptLevel.level} 한자'),
        backgroundColor: color.withOpacity(0.1),
        actions: [
          // 뷰 전환 버튼
          IconButton(
            icon: Icon(_isGridView ? Icons.view_list : Icons.grid_view),
            onPressed: () {
              setState(() {
                _isGridView = !_isGridView;
              });
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // 상단 정보
                _buildHeader(color),
                // 한자 목록
                Expanded(
                  child: _isGridView ? _buildGridView() : _buildListView(),
                ),
              ],
            ),
    );
  }

  Widget _buildHeader(Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.05),
        border: Border(
          bottom: BorderSide(
            color: color.withOpacity(0.2),
          ),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              widget.jlptLevel.level,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            '${_kanjiList.length}자',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const Spacer(),
          Text(
            widget.jlptLevel.description,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context)
                      .colorScheme
                      .onSurface
                      .withOpacity(0.7),
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildGridView() {
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 5,
        childAspectRatio: 1,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
      ),
      itemCount: _kanjiList.length,
      itemBuilder: (context, index) {
        final kanji = _kanjiList[index];
        return KanjiGridTile(
          kanji: kanji,
          onTap: () => _navigateToDetail(kanji),
        );
      },
    );
  }

  Widget _buildListView() {
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: _kanjiList.length,
      itemBuilder: (context, index) {
        final kanji = _kanjiList[index];
        return _KanjiListTile(
          kanji: kanji,
          onTap: () => _navigateToDetail(kanji),
        );
      },
    );
  }

  void _navigateToDetail(Kanji kanji) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => KanjiDetailScreen(kanji: kanji),
      ),
    );
  }
}

/// 리스트 뷰용 한자 타일
class _KanjiListTile extends StatelessWidget {
  final Kanji kanji;
  final VoidCallback onTap;

  const _KanjiListTile({
    required this.kanji,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              // 한자
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: Theme.of(context)
                      .colorScheme
                      .primaryContainer
                      .withOpacity(0.5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Center(
                  child: Text(
                    kanji.literal,
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),

              // 정보
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 음독/훈독
                    if (kanji.jaOn.isNotEmpty)
                      Text(
                        '音: ${kanji.onReadings}',
                        style: Theme.of(context).textTheme.bodyMedium,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    if (kanji.jaKun.isNotEmpty)
                      Text(
                        '訓: ${kanji.kunReadings}',
                        style: Theme.of(context).textTheme.bodyMedium,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    // 한국어 훈음
                    if (kanji.koreanHunEum != null)
                      Text(
                        '韓: ${kanji.koreanHunEum}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context).colorScheme.primary,
                            ),
                      ),
                  ],
                ),
              ),

              // 메타 정보
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    kanji.gradeDisplay,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  Text(
                    '${kanji.strokeCount}획',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withOpacity(0.6),
                        ),
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
