import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';

import '../models/kanji.dart';

/// 획순 애니메이션 뷰
class StrokeAnimationView extends StatefulWidget {
  final Kanji kanji;
  final double size;

  const StrokeAnimationView({
    super.key,
    required this.kanji,
    this.size = 200,
  });

  @override
  State<StrokeAnimationView> createState() => _StrokeAnimationViewState();
}

class _StrokeAnimationViewState extends State<StrokeAnimationView>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  int _currentStroke = 0;
  bool _isAnimating = false;
  bool _showAllStrokes = true;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        _nextStroke();
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _startAnimation() {
    setState(() {
      _isAnimating = true;
      _showAllStrokes = false;
      _currentStroke = 0;
    });
    _controller.forward(from: 0);
  }

  void _nextStroke() {
    if (_currentStroke < widget.kanji.strokePaths.length - 1) {
      setState(() {
        _currentStroke++;
      });
      _controller.forward(from: 0);
    } else {
      setState(() {
        _isAnimating = false;
        _showAllStrokes = true;
      });
    }
  }

  void _reset() {
    _controller.stop();
    setState(() {
      _isAnimating = false;
      _showAllStrokes = true;
      _currentStroke = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // 캔버스 영역
        Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: Theme.of(context).colorScheme.outline.withOpacity(0.3),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 10,
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: AnimatedBuilder(
              animation: _controller,
              builder: (context, child) {
                return CustomPaint(
                  size: Size(widget.size, widget.size),
                  painter: StrokePainter(
                    strokes: widget.kanji.strokePaths,
                    currentStroke: _currentStroke,
                    animationProgress: _controller.value,
                    showAllStrokes: _showAllStrokes,
                    isAnimating: _isAnimating,
                    strokeColor: Theme.of(context).colorScheme.onSurface,
                    guideColor: Theme.of(context)
                        .colorScheme
                        .outline
                        .withOpacity(0.2),
                  ),
                );
              },
            ),
          ),
        ),

        const SizedBox(height: 16),

        // 컨트롤 버튼
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // 재생 버튼
            ElevatedButton.icon(
              onPressed: _isAnimating ? null : _startAnimation,
              icon: const Icon(Icons.play_arrow),
              label: const Text('획순 보기'),
            ),
            const SizedBox(width: 12),
            // 리셋 버튼
            OutlinedButton.icon(
              onPressed: _reset,
              icon: const Icon(Icons.refresh),
              label: const Text('처음부터'),
            ),
          ],
        ),

        const SizedBox(height: 8),

        // 현재 획 표시
        if (_isAnimating)
          Text(
            '${_currentStroke + 1} / ${widget.kanji.strokePaths.length} 획',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.bold,
                ),
          ),
      ],
    );
  }
}

/// 획순 페인터
class StrokePainter extends CustomPainter {
  final List<StrokePath> strokes;
  final int currentStroke;
  final double animationProgress;
  final bool showAllStrokes;
  final bool isAnimating;
  final Color strokeColor;
  final Color guideColor;

  StrokePainter({
    required this.strokes,
    required this.currentStroke,
    required this.animationProgress,
    required this.showAllStrokes,
    required this.isAnimating,
    required this.strokeColor,
    required this.guideColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (strokes.isEmpty) return;

    // KanjiVG의 기본 뷰박스는 109x109
    const double viewBoxSize = 109.0;
    final double scale = size.width / viewBoxSize;

    // 스케일 변환
    canvas.scale(scale, scale);

    // 완료된 획 (회색 가이드)
    final guidePaint = Paint()
      ..color = guideColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    // 현재 그려지는 획 (검정)
    final activePaint = Paint()
      ..color = strokeColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    // 이전에 완료된 획
    final completedPaint = Paint()
      ..color = strokeColor.withOpacity(0.6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    if (showAllStrokes) {
      // 모든 획 표시
      for (final stroke in strokes) {
        final path = _parseSvgPath(stroke.path);
        if (path != null) {
          canvas.drawPath(path, activePaint);
        }
      }

      // 획순 번호 표시
      _drawStrokeNumbers(canvas, strokes);
    } else if (isAnimating) {
      // 가이드 (아직 안 그린 획)
      for (int i = currentStroke + 1; i < strokes.length; i++) {
        final path = _parseSvgPath(strokes[i].path);
        if (path != null) {
          canvas.drawPath(path, guidePaint);
        }
      }

      // 이미 완료된 획
      for (int i = 0; i < currentStroke; i++) {
        final path = _parseSvgPath(strokes[i].path);
        if (path != null) {
          canvas.drawPath(path, completedPaint);
        }
      }

      // 현재 획 (애니메이션)
      if (currentStroke < strokes.length) {
        final path = _parseSvgPath(strokes[currentStroke].path);
        if (path != null) {
          final animatedPath = _extractPathSegment(path, animationProgress);
          canvas.drawPath(animatedPath, activePaint);

          // 현재 획 번호 표시
          _drawStrokeNumber(
            canvas,
            currentStroke + 1,
            strokes[currentStroke].startX,
            strokes[currentStroke].startY,
            isActive: true,
          );
        }
      }
    }
  }

  /// SVG path 문자열을 Flutter Path로 변환
  Path? _parseSvgPath(String pathData) {
    if (pathData.isEmpty) return null;

    final path = Path();
    final regex = RegExp(
      r'([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)',
    );

    double currentX = 0;
    double currentY = 0;
    double? lastControlX;
    double? lastControlY;
    String? lastCommand;

    for (final match in regex.allMatches(pathData)) {
      final command = match.group(1)!;
      final argsStr = match.group(2)?.trim() ?? '';
      final args = _parseNumbers(argsStr);

      switch (command) {
        case 'M':
          if (args.length >= 2) {
            currentX = args[0];
            currentY = args[1];
            path.moveTo(currentX, currentY);
          }
          break;

        case 'm':
          if (args.length >= 2) {
            currentX += args[0];
            currentY += args[1];
            path.moveTo(currentX, currentY);
          }
          break;

        case 'L':
          for (int i = 0; i < args.length - 1; i += 2) {
            currentX = args[i];
            currentY = args[i + 1];
            path.lineTo(currentX, currentY);
          }
          break;

        case 'l':
          for (int i = 0; i < args.length - 1; i += 2) {
            currentX += args[i];
            currentY += args[i + 1];
            path.lineTo(currentX, currentY);
          }
          break;

        case 'H':
          if (args.isNotEmpty) {
            currentX = args[0];
            path.lineTo(currentX, currentY);
          }
          break;

        case 'h':
          if (args.isNotEmpty) {
            currentX += args[0];
            path.lineTo(currentX, currentY);
          }
          break;

        case 'V':
          if (args.isNotEmpty) {
            currentY = args[0];
            path.lineTo(currentX, currentY);
          }
          break;

        case 'v':
          if (args.isNotEmpty) {
            currentY += args[0];
            path.lineTo(currentX, currentY);
          }
          break;

        case 'C':
          for (int i = 0; i < args.length - 5; i += 6) {
            final x1 = args[i];
            final y1 = args[i + 1];
            final x2 = args[i + 2];
            final y2 = args[i + 3];
            final x = args[i + 4];
            final y = args[i + 5];
            path.cubicTo(x1, y1, x2, y2, x, y);
            lastControlX = x2;
            lastControlY = y2;
            currentX = x;
            currentY = y;
          }
          break;

        case 'c':
          for (int i = 0; i < args.length - 5; i += 6) {
            final x1 = currentX + args[i];
            final y1 = currentY + args[i + 1];
            final x2 = currentX + args[i + 2];
            final y2 = currentY + args[i + 3];
            final x = currentX + args[i + 4];
            final y = currentY + args[i + 5];
            path.cubicTo(x1, y1, x2, y2, x, y);
            lastControlX = x2;
            lastControlY = y2;
            currentX = x;
            currentY = y;
          }
          break;

        case 'S':
          for (int i = 0; i < args.length - 3; i += 4) {
            final x1 = lastCommand == 'C' || lastCommand == 'c' ||
                    lastCommand == 'S' || lastCommand == 's'
                ? 2 * currentX - (lastControlX ?? currentX)
                : currentX;
            final y1 = lastCommand == 'C' || lastCommand == 'c' ||
                    lastCommand == 'S' || lastCommand == 's'
                ? 2 * currentY - (lastControlY ?? currentY)
                : currentY;
            final x2 = args[i];
            final y2 = args[i + 1];
            final x = args[i + 2];
            final y = args[i + 3];
            path.cubicTo(x1, y1, x2, y2, x, y);
            lastControlX = x2;
            lastControlY = y2;
            currentX = x;
            currentY = y;
          }
          break;

        case 's':
          for (int i = 0; i < args.length - 3; i += 4) {
            final x1 = lastCommand == 'C' || lastCommand == 'c' ||
                    lastCommand == 'S' || lastCommand == 's'
                ? 2 * currentX - (lastControlX ?? currentX)
                : currentX;
            final y1 = lastCommand == 'C' || lastCommand == 'c' ||
                    lastCommand == 'S' || lastCommand == 's'
                ? 2 * currentY - (lastControlY ?? currentY)
                : currentY;
            final x2 = currentX + args[i];
            final y2 = currentY + args[i + 1];
            final x = currentX + args[i + 2];
            final y = currentY + args[i + 3];
            path.cubicTo(x1, y1, x2, y2, x, y);
            lastControlX = x2;
            lastControlY = y2;
            currentX = x;
            currentY = y;
          }
          break;

        case 'Z':
        case 'z':
          path.close();
          break;
      }

      lastCommand = command;
    }

    return path;
  }

  /// 숫자 문자열 파싱
  List<double> _parseNumbers(String str) {
    final regex = RegExp(r'-?[\d.]+');
    return regex
        .allMatches(str)
        .map((m) => double.tryParse(m.group(0)!) ?? 0)
        .toList();
  }

  /// 애니메이션용 path 세그먼트 추출
  Path _extractPathSegment(Path fullPath, double progress) {
    final metrics = fullPath.computeMetrics().toList();
    if (metrics.isEmpty) return Path();

    final totalLength =
        metrics.fold<double>(0, (sum, m) => sum + m.length);
    final targetLength = totalLength * progress;

    final extractedPath = Path();
    double accumulatedLength = 0;

    for (final metric in metrics) {
      if (accumulatedLength + metric.length <= targetLength) {
        extractedPath.addPath(
          metric.extractPath(0, metric.length),
          Offset.zero,
        );
        accumulatedLength += metric.length;
      } else {
        final remainingLength = targetLength - accumulatedLength;
        if (remainingLength > 0) {
          extractedPath.addPath(
            metric.extractPath(0, remainingLength),
            Offset.zero,
          );
        }
        break;
      }
    }

    return extractedPath;
  }

  /// 획순 번호 표시
  void _drawStrokeNumbers(Canvas canvas, List<StrokePath> strokes) {
    for (int i = 0; i < strokes.length; i++) {
      _drawStrokeNumber(
        canvas,
        i + 1,
        strokes[i].startX,
        strokes[i].startY,
      );
    }
  }

  /// 단일 획순 번호 표시
  void _drawStrokeNumber(
    Canvas canvas,
    int number,
    double x,
    double y, {
    bool isActive = false,
  }) {
    final bgPaint = Paint()
      ..color = isActive ? Colors.red : Colors.blue.withOpacity(0.7);

    canvas.drawCircle(Offset(x, y), 6, bgPaint);

    final textPainter = TextPainter(
      text: TextSpan(
        text: number.toString(),
        style: const TextStyle(
          color: Colors.white,
          fontSize: 8,
          fontWeight: FontWeight.bold,
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(x - textPainter.width / 2, y - textPainter.height / 2),
    );
  }

  @override
  bool shouldRepaint(StrokePainter oldDelegate) {
    return oldDelegate.currentStroke != currentStroke ||
        oldDelegate.animationProgress != animationProgress ||
        oldDelegate.showAllStrokes != showAllStrokes ||
        oldDelegate.isAnimating != isAnimating;
  }
}
