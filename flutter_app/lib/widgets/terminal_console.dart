import 'package:flutter/material.dart';

import '../models.dart';
import '../theme.dart';

class TerminalConsole extends StatefulWidget {
  final List<LogLine> lines;
  final bool busy;

  const TerminalConsole({super.key, required this.lines, required this.busy});

  @override
  State<TerminalConsole> createState() => _TerminalConsoleState();
}

class _TerminalConsoleState extends State<TerminalConsole> {
  final _scrollController = ScrollController();

  @override
  void didUpdateWidget(covariant TerminalConsole oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.lines.length != widget.lines.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!_scrollController.hasClients) return;
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeOut,
        );
      });
    }
  }

  Color _colorFor(LogKind kind) => switch (kind) {
        LogKind.error => AppColors.red,
        LogKind.success => AppColors.cyan,
        LogKind.system => AppColors.textDim,
        LogKind.log => AppColors.green,
      };

  String _prefixFor(LogKind kind) => switch (kind) {
        LogKind.error => '!! ',
        LogKind.success => 'OK ',
        LogKind.system => '# ',
        LogKind.log => '> ',
      };

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.panel,
        border: Border.all(color: AppColors.panelBorder),
        borderRadius: BorderRadius.circular(8),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'REAL-TIME CONSOLE',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: AppColors.cyan.withValues(alpha: 0.85),
                      letterSpacing: 2,
                    ),
              ),
              Text(
                widget.busy ? 'running...' : 'idle',
                style: const TextStyle(color: AppColors.textDim, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            height: 320,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: Colors.black,
              border: Border.all(color: AppColors.panelBorder),
              borderRadius: BorderRadius.circular(6),
            ),
            child: widget.lines.isEmpty
                ? const Text(
                    '# Installer ready. Select a game folder and press INJECT CHEAT ENGINE.',
                    style: TextStyle(color: AppColors.textDim, fontSize: 13),
                  )
                : ListView.builder(
                    controller: _scrollController,
                    itemCount: widget.lines.length,
                    itemBuilder: (context, index) {
                      final line = widget.lines[index];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 3),
                        child: Text(
                          '${_prefixFor(line.kind)}${line.message}',
                          style: TextStyle(
                            color: _colorFor(line.kind),
                            fontSize: 13,
                            height: 1.5,
                            fontWeight: line.kind == LogKind.success ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
