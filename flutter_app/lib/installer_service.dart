/// Orchestrates inject / uninstall against a [GameFileSystem] target,
/// mirroring install-gui.js's handleInject / handleUninstall step for step
/// so the two platforms behave identically to the original Node tool.
library;

import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;

import 'cheat_library.dart';
import 'game_fs.dart';
import 'models.dart';
import 'plugins_js.dart';

const corePluginFileNames = ['CheatEngine_Core.js', 'CheatEngine_UI.js'];
const cheatEnginePrefix = 'CheatEngine_';
final RegExp _cheatEngineFilePattern = RegExp(r'^CheatEngine_.+\.js$', caseSensitive: false);
final RegExp _cheatEngineNamePattern = RegExp(r'^CheatEngine_.+$', caseSensitive: false);

class InstallerException implements Exception {
  final String message;
  const InstallerException(this.message);
  @override
  String toString() => message;
}

Future<Uint8List> _loadCorePlugin(String fileName) async {
  final data = await rootBundle.load('assets/plugins/$fileName');
  return data.buffer.asUint8List();
}

/// Detects MV ("www/" at the root) vs MZ ("js/plugins/" at the root)
/// directly under [fs]'s target root. Returns null if neither layout exists.
Future<EngineDetection?> detectEngine(GameFileSystem fs) async {
  if (await fs.dirExists(['www'])) {
    return const EngineDetection(
      engine: Engine.mv,
      pluginsDirSegments: ['www', 'js', 'plugins'],
      pluginsJsSegments: ['www', 'js', 'plugins.js'],
    );
  }
  if (await fs.dirExists(['js', 'plugins'])) {
    return const EngineDetection(
      engine: Engine.mz,
      pluginsDirSegments: ['js', 'plugins'],
      pluginsJsSegments: ['js', 'plugins.js'],
    );
  }
  return null;
}

class InstallerService {
  const InstallerService();

  Future<InstallOutcome> inject({
    required GameFileSystem fs,
    CheatSource? selectedCheat,
    String? manualId,
    required bool backupEnabled,
    required void Function(String message, LogKind kind) log,
  }) async {
    log('Target game folder: ${fs.displayPath}', LogKind.system);

    final detected = await detectEngine(fs);
    if (detected == null) {
      throw const InstallerException(
        'Could not detect an RPG Maker MV or MZ project here (no "www" folder and no "js/plugins" folder found).',
      );
    }
    log('Engine detected: RPG Maker ${detected.engine.label}', LogKind.log);
    log('Plugins directory: ${detected.pluginsDirSegments.join('/')}', LogKind.log);

    if (!await fs.fileExists(detected.pluginsJsSegments)) {
      throw InstallerException('plugins.js not found: ${detected.pluginsJsSegments.join('/')}');
    }

    // Resolve which cheat (if any) to install, generating a skeleton for a
    // manually-typed ID with no matching scanned file -- same as the Node
    // tool's buildSkeletonCheatSource fallback.
    CheatSource? cheat = selectedCheat;
    bool generated = false;
    if (cheat == null && manualId != null && manualId.isNotEmpty) {
      final idError = validateCheatId(manualId);
      if (idError != null) throw InstallerException(idError);
      cheat = await generateSkeletonCheatSource(manualId);
      generated = true;
      log('No matching cheat file, so a new skeleton was generated: ${cheat.fileName} -> ${cheat.installedFileName}', LogKind.log);
    } else if (cheat != null) {
      log('Using cheat file: ${cheat.fileName} -> ${cheat.installedFileName}', LogKind.log);
    } else {
      log('No custom cheat file selected -- installing only the core engine (CheatEngine_Core / CheatEngine_UI).', LogKind.log);
    }

    if (backupEnabled) {
      final original = await fs.readFile(detected.pluginsJsSegments);
      final backupSegments = [...detected.pluginsJsSegments];
      backupSegments[backupSegments.length - 1] = '${backupSegments.last}.bak';
      await fs.writeFile(backupSegments, original!);
      log('Backed up plugins.js -> ${backupSegments.last}', LogKind.log);
    } else {
      log('Safe backup is disabled -- plugins.js will be modified without a .bak copy.', LogKind.system);
    }

    final filesToCopy = <({String name, Uint8List bytes})>[
      for (final name in corePluginFileNames) (name: name, bytes: await _loadCorePlugin(name)),
      if (cheat != null) (name: cheat.installedFileName, bytes: Uint8List.fromList(await cheat.loadBytes())),
    ];

    for (final file in filesToCopy) {
      await fs.writeFile([...detected.pluginsDirSegments, file.name], file.bytes);
      log('Copied: ${file.name}', LogKind.log);
    }

    final rawPluginsJs = utf8.decode((await fs.readFile(detected.pluginsJsSegments))!);
    final parsed = parsePluginsJs(rawPluginsJs, detected.pluginsJsSegments.join('/'));
    for (final file in filesToCopy) {
      final name = file.name.replaceFirst(RegExp(r'\.js$'), '');
      final description = extractDescription(utf8.decode(file.bytes));
      final outcome = upsertPluginEntry(parsed.list, name, description);
      log('plugins.js: $name -> ${outcome.label}', LogKind.log);
    }
    final serialized = serializePluginsJs(parsed.header, parsed.list);
    await fs.writeFile(detected.pluginsJsSegments, Uint8List.fromList(utf8.encode(serialized)));

    log('Injection complete.', LogKind.log);
    return InstallOutcome(
      success: true,
      engine: detected.engine,
      cheatFile: cheat?.installedFileName,
      generated: generated,
    );
  }

  Future<InstallOutcome> uninstall({
    required GameFileSystem fs,
    required void Function(String message, LogKind kind) log,
  }) async {
    log('Target game folder: ${fs.displayPath}', LogKind.system);

    final detected = await detectEngine(fs);
    if (detected == null) {
      throw const InstallerException(
        'Could not detect an RPG Maker MV or MZ project here (no "www" folder and no "js/plugins" folder found).',
      );
    }
    log('Engine detected: RPG Maker ${detected.engine.label}', LogKind.log);
    log('Plugins directory: ${detected.pluginsDirSegments.join('/')}', LogKind.log);

    if (!await fs.fileExists(detected.pluginsJsSegments)) {
      throw InstallerException('plugins.js not found: ${detected.pluginsJsSegments.join('/')}');
    }

    final backupSegments = [...detected.pluginsJsSegments];
    backupSegments[backupSegments.length - 1] = '${backupSegments.last}.bak';

    if (await fs.fileExists(backupSegments)) {
      final backupBytes = await fs.readFile(backupSegments);
      await fs.writeFile(detected.pluginsJsSegments, backupBytes!);
      await fs.deleteFile(backupSegments);
      log('Restored plugins.js from backup and removed ${backupSegments.last}.', LogKind.log);
    } else {
      log('No backup file found -- stripping Cheat Engine entries out of plugins.js directly.', LogKind.system);
      final raw = utf8.decode((await fs.readFile(detected.pluginsJsSegments))!);
      final parsed = parsePluginsJs(raw, detected.pluginsJsSegments.join('/'));
      final removedNames = <String>[];
      final kept = parsed.list.where((entry) {
        final name = (entry['name'] as String?) ?? '';
        if (_cheatEngineNamePattern.hasMatch(name)) {
          removedNames.add(name);
          return false;
        }
        return true;
      }).toList();
      await fs.writeFile(detected.pluginsJsSegments, Uint8List.fromList(utf8.encode(serializePluginsJs(parsed.header, kept))));
      if (removedNames.isEmpty) {
        log('plugins.js: no Cheat Engine entries were found to remove.', LogKind.log);
      } else {
        for (final name in removedNames) {
          log('plugins.js: removed entry -> $name', LogKind.log);
        }
      }
    }

    final namesToDelete = {...corePluginFileNames};
    for (final name in await fs.listNames(detected.pluginsDirSegments)) {
      if (_cheatEngineFilePattern.hasMatch(name)) namesToDelete.add(name);
    }
    var deletedCount = 0;
    for (final name in namesToDelete) {
      final segments = [...detected.pluginsDirSegments, name];
      if (await fs.fileExists(segments)) {
        await fs.deleteFile(segments);
        log('Deleted: $name', LogKind.log);
        deletedCount++;
      }
    }
    if (deletedCount == 0) {
      log('No Cheat Engine plugin files were found on disk to delete.', LogKind.log);
    }

    log('Uninstall complete.', LogKind.log);
    return InstallOutcome(success: true, engine: detected.engine);
  }
}
