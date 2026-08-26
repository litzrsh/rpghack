/// The set of cheat files that can be selected in the "Cheat File Selector"
/// panel: files bundled with the app (assets/custom_cheats/) plus any the
/// user has imported at runtime into the app's private storage. Also
/// generates the same auto-skeleton the original installer wrote for a
/// manually-typed Game ID with no matching file.
library;

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:path_provider/path_provider.dart';

import 'models.dart';

const _genericFileNamePattern = r'^[A-Za-z0-9_-]+\.(js|json)$';
final RegExp _genericFileNameRegExp = RegExp(_genericFileNamePattern);
final RegExp _idRegExp = RegExp(r'^[A-Za-z0-9_-]+$');
const _reservedIds = {'CORE', 'UI'};
const reservedIdMessage = 'Error: "Core" and "UI" are reserved system IDs and cannot be used.';

bool isReservedId(String id) => _reservedIds.contains(id.toUpperCase());

/// Returns an error message, or null if [id] is a valid Game ID.
String? validateCheatId(String id) {
  if (!_idRegExp.hasMatch(id)) {
    return 'Invalid ID "$id": only letters, numbers, underscores, and hyphens are allowed.';
  }
  if (isReservedId(id)) return reservedIdMessage;
  return null;
}

Future<Directory> _importedCheatsDir() async {
  final support = await getApplicationSupportDirectory();
  final dir = Directory('${support.path}/custom_cheats');
  await dir.create(recursive: true);
  return dir;
}

/// Scans bundled assets/custom_cheats/*.js|*.json plus any imported into the
/// app's private storage. Files whose ID collides with a reserved system
/// name ("Core"/"UI") are skipped, mirroring the original scan behavior.
Future<List<CheatSource>> scanCheatSources() async {
  final sources = <CheatSource>[];

  final manifestRaw = await rootBundle.loadString('AssetManifest.json');
  final manifest = jsonDecode(manifestRaw) as Map<String, dynamic>;
  for (final assetPath in manifest.keys) {
    const prefix = 'assets/custom_cheats/';
    if (!assetPath.startsWith(prefix)) continue;
    final fileName = assetPath.substring(prefix.length);
    if (!_genericFileNameRegExp.hasMatch(fileName)) continue;
    final id = fileName.replaceFirst(RegExp(r'\.(js|json)$', caseSensitive: false), '');
    if (isReservedId(id)) continue;
    sources.add(CheatSource(
      id: id,
      fileName: fileName,
      isBundled: true,
      loadBytes: () async => (await rootBundle.load(assetPath)).buffer.asUint8List(),
    ));
  }

  final importedDir = await _importedCheatsDir();
  await for (final entity in importedDir.list()) {
    if (entity is! File) continue;
    final fileName = entity.uri.pathSegments.last;
    if (!_genericFileNameRegExp.hasMatch(fileName)) continue;
    final id = fileName.replaceFirst(RegExp(r'\.(js|json)$', caseSensitive: false), '');
    if (isReservedId(id)) continue;
    sources.add(CheatSource(
      id: id,
      fileName: fileName,
      isBundled: false,
      loadBytes: () => entity.readAsBytes(),
    ));
  }

  sources.sort((a, b) => a.fileName.toLowerCase().compareTo(b.fileName.toLowerCase()));
  return sources;
}

/// Copies a user-picked file into the app's private cheat library so it
/// shows up in future scans. Returns an error message, or null on success.
Future<String?> importCheatFile(String fileName, Uint8List bytes) async {
  if (!_genericFileNameRegExp.hasMatch(fileName)) {
    return 'Only .js or .json files with a safe name (letters, numbers, "_", "-") can be imported.';
  }
  final id = fileName.replaceFirst(RegExp(r'\.(js|json)$', caseSensitive: false), '');
  final idError = validateCheatId(id);
  if (idError != null) return idError;

  final dir = await _importedCheatsDir();
  final file = File('${dir.path}/$fileName');
  await file.writeAsBytes(bytes, flush: true);
  return null;
}

/// Same skeleton the Node installer generated for a manually-typed Game ID
/// with no matching scanned file -- persisted into the app's cheat library
/// (like custom_cheats/{id}.js did) so it can be found again and edited.
String buildSkeletonCheatSource(String id) {
  final registeredName = 'CheatEngine_$id';
  return '''
//=============================================================================
// $registeredName.js
//=============================================================================
/*:
 * @plugindesc [Cheat Engine] $id v1.0.0 - Game-specific cheat tab skeleton for $id (extends CheatEngine_UI.js).
 * @author rpghack
 * @base CheatEngine_Core
 * @base CheatEngine_UI
 * @orderAfter CheatEngine_Core
 * @orderAfter CheatEngine_UI
 * @url
 *
 * @help
 * $registeredName.js
 * -----------------------------------------------------------------------------
 * Auto-generated skeleton, created by the app because no matching cheat file
 * was found. Fill in buildDescriptors() below with this game's own hardcoded
 * variable IDs / plugin commands.
 * -----------------------------------------------------------------------------
 */

(() => {
    "use strict";

    if (typeof RpgBridge === "undefined" || typeof CheatManager === "undefined" || !CheatManager) {
        console.error("$registeredName.js: CheatEngine_Core.js must be loaded first.");
        return;
    }
    if (typeof window.CheatEngineUI === "undefined" || typeof window.CheatEngineUI.registerTab !== "function") {
        console.error("$registeredName.js: CheatEngine_UI.js must be loaded first.");
        return;
    }

    // TODO: replace this placeholder with real descriptors for $id
    // (variable IDs, plugin commands, etc.). Use the same descriptor shape
    // as the rest of CheatEngine_UI.js: type is one of "number" | "boolean" |
    // "choice" | "action" | "info", each with a get() and (except "info")
    // a set() or action().
    function buildDescriptors() {
        return [
            { name: "TODO: add $id-specific cheats here", type: "info", get: () => "" }
        ];
    }

    window.CheatEngineUI.registerTab({
        name: "$id",
        enabled: true,
        builder: buildDescriptors,
        columns: 1
    });
})();
''';
}

/// Generates and persists a skeleton for [id] into the cheat library,
/// returning the new [CheatSource].
Future<CheatSource> generateSkeletonCheatSource(String id) async {
  final source = buildSkeletonCheatSource(id);
  final bytes = Uint8List.fromList(utf8.encode(source));
  final dir = await _importedCheatsDir();
  final fileName = '$id.js';
  final file = File('${dir.path}/$fileName');
  await file.writeAsBytes(bytes, flush: true);
  return CheatSource(
    id: id,
    fileName: fileName,
    isBundled: false,
    loadBytes: () async => bytes,
  );
}
