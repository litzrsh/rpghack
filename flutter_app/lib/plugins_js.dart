/// Reading and writing RPG Maker's `js/plugins.js` -- the same
/// `var $plugins = [...]` format both MV and MZ use. Ported line-for-line
/// from the original install-gui.js so injected/uninstalled games end up in
/// exactly the same state the Node tool would have produced.
library;

import 'dart:convert';

import 'models.dart';

final RegExp _headerPattern = RegExp(r'^([\s\S]*?)var\s+\$plugins\s*=');
final RegExp _bodyPattern = RegExp(r'var\s+\$plugins\s*=\s*(\[[\s\S]*\])\s*;?\s*$');
final RegExp _plugindescPattern = RegExp(r'@plugindesc\s+(.+)');

class ParsedPluginsJs {
  final List<Map<String, dynamic>> list;
  final String header;
  const ParsedPluginsJs(this.list, this.header);
}

class PluginsJsFormatException implements Exception {
  final String message;
  const PluginsJsFormatException(this.message);
  @override
  String toString() => message;
}

ParsedPluginsJs parsePluginsJs(String raw, String pathForError) {
  final headerMatch = _headerPattern.firstMatch(raw);
  final bodyMatch = _bodyPattern.firstMatch(raw);
  if (headerMatch == null || bodyMatch == null) {
    throw PluginsJsFormatException(
      'Could not parse plugins.js (expected a "var \$plugins = [...]" declaration): $pathForError',
    );
  }
  List<dynamic> decoded;
  try {
    decoded = jsonDecode(bodyMatch.group(1)!) as List<dynamic>;
  } catch (e) {
    throw PluginsJsFormatException('Failed to parse the \$plugins array as JSON: $e');
  }
  final list = decoded.cast<Map<String, dynamic>>();
  return ParsedPluginsJs(list, headerMatch.group(1)!);
}

String serializePluginsJs(String header, List<Map<String, dynamic>> list) {
  final body = '[\n${list.map((p) => jsonEncode(p)).join(",\n")}\n]';
  return '${header}var \$plugins =\n$body\n;\n';
}

/// Adds a plugin entry if missing, or flips `status` back to true if it's
/// already registered (but disabled). Never touches an existing entry's
/// parameters/description, so a user's own configuration is preserved.
UpsertOutcome upsertPluginEntry(List<Map<String, dynamic>> list, String name, String description) {
  for (final entry in list) {
    if (entry['name'] == name) {
      if (entry['status'] == true) return UpsertOutcome.alreadyEnabled;
      entry['status'] = true;
      return UpsertOutcome.enabled;
    }
  }
  list.add({'name': name, 'status': true, 'description': description, 'parameters': {}});
  return UpsertOutcome.added;
}

/// Extracts the (default-locale) `@plugindesc` line from a plugin source,
/// used as the description shown in the RPG Maker Plugin Manager.
String extractDescription(String source) {
  final m = _plugindescPattern.firstMatch(source);
  return m != null ? m.group(1)!.trim() : '';
}
