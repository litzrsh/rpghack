/// Shared value types used across the installer.
library;

/// Which RPG Maker engine layout was detected under a target root.
enum Engine { mv, mz }

extension EngineLabel on Engine {
  String get label => this == Engine.mv ? 'MV' : 'MZ';
}

/// Result of [detectEngine]: which engine, and where its plugins/ folder and
/// plugins.js live, expressed as path segments relative to the target root
/// (so the same detection logic works for both a real filesystem root and a
/// SAF document-tree root).
class EngineDetection {
  final Engine engine;
  final List<String> pluginsDirSegments;
  final List<String> pluginsJsSegments;

  const EngineDetection({
    required this.engine,
    required this.pluginsDirSegments,
    required this.pluginsJsSegments,
  });
}

/// One installable cheat source: either a bundled asset or a user-imported
/// file living in the app's private cheat library.
class CheatSource {
  /// The Game ID, e.g. "RJ386773" -- becomes "CheatEngine_{id}.js" on install.
  final String id;

  /// Original file name as scanned (e.g. "RJ386773.js" or "Steam_123450.json").
  final String fileName;

  /// True for files bundled with the app (assets/custom_cheats/); false for
  /// ones the user imported at runtime.
  final bool isBundled;

  final Future<List<int>> Function() loadBytes;

  const CheatSource({
    required this.id,
    required this.fileName,
    required this.isBundled,
    required this.loadBytes,
  });

  /// The name this cheat will be installed under in the target game.
  String get installedFileName => 'CheatEngine_$id.js';
}

/// Outcome of upserting one plugin entry into plugins.js.
enum UpsertOutcome { added, enabled, alreadyEnabled }

extension UpsertOutcomeLabel on UpsertOutcome {
  String get label => switch (this) {
        UpsertOutcome.added => 'added + enabled',
        UpsertOutcome.enabled => 'existing entry enabled',
        UpsertOutcome.alreadyEnabled => 'already enabled',
      };
}

/// Terminal line kinds, mirroring the original browser console's styling.
enum LogKind { log, error, success, system }

class LogLine {
  final String message;
  final LogKind kind;
  const LogLine(this.message, this.kind);
}

class InstallOutcome {
  final bool success;
  final Engine? engine;
  final String? cheatFile;
  final bool generated;

  const InstallOutcome({
    required this.success,
    this.engine,
    this.cheatFile,
    this.generated = false,
  });
}
