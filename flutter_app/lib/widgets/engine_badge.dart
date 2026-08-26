import 'package:flutter/material.dart';

import '../models.dart';
import '../theme.dart';

enum BadgeState { idle, mv, mz, none }

class EngineBadge extends StatelessWidget {
  final BadgeState state;

  const EngineBadge({super.key, required this.state});

  (Color, String) get _styleAndText => switch (state) {
        BadgeState.idle => (AppColors.textDim, 'Awaiting Folder'),
        BadgeState.mv => (AppColors.green, '[ MV Detected ]'),
        BadgeState.mz => (const Color(0xFF4FA8FF), '[ MZ Detected ]'),
        BadgeState.none => (AppColors.red, '[ No Engine Found ]'),
      };

  @override
  Widget build(BuildContext context) {
    final (color, text) = _styleAndText;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        border: Border.all(color: color),
        borderRadius: BorderRadius.circular(4),
        color: Colors.white.withValues(alpha: 0.03),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Text(
            text,
            style: TextStyle(color: color, fontWeight: FontWeight.bold, letterSpacing: 1, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

BadgeState badgeStateForEngine(Engine? engine, bool hasTarget) {
  if (!hasTarget) return BadgeState.idle;
  if (engine == Engine.mv) return BadgeState.mv;
  if (engine == Engine.mz) return BadgeState.mz;
  return BadgeState.none;
}
