/// Abstraction over "a target game folder" so the installer logic (engine
/// detection, plugin copying, plugins.js editing) is identical on both
/// platforms:
///   - Windows: a real filesystem path, via dart:io.
///   - Android: a SAF document-tree URI, since scoped storage gives no raw
///     path for a user-picked folder outside the app's own sandbox.
library;

import 'dart:io';
import 'dart:typed_data';

import 'package:path/path.dart' as p;
import 'package:saf/saf.dart';

abstract class GameFileSystem {
  /// Human-readable location, shown in the UI and console log.
  String get displayPath;

  Future<bool> dirExists(List<String> segments);
  Future<bool> fileExists(List<String> segments);

  /// Returns null if the file does not exist.
  Future<Uint8List?> readFile(List<String> segments);

  /// Creates parent directories as needed and overwrites any existing file.
  Future<void> writeFile(List<String> segments, Uint8List data);

  /// No-op if the file does not exist.
  Future<void> deleteFile(List<String> segments);

  /// Names of every entry directly inside [segments] (not recursive).
  Future<List<String>> listNames(List<String> segments);
}

class WindowsGameFileSystem implements GameFileSystem {
  final String root;
  const WindowsGameFileSystem(this.root);

  @override
  String get displayPath => root;

  String _join(List<String> segments) => p.joinAll([root, ...segments]);

  @override
  Future<bool> dirExists(List<String> segments) => Directory(_join(segments)).exists();

  @override
  Future<bool> fileExists(List<String> segments) => File(_join(segments)).exists();

  @override
  Future<Uint8List?> readFile(List<String> segments) async {
    final file = File(_join(segments));
    if (!await file.exists()) return null;
    return file.readAsBytes();
  }

  @override
  Future<void> writeFile(List<String> segments, Uint8List data) async {
    final file = File(_join(segments));
    await file.parent.create(recursive: true);
    await file.writeAsBytes(data, flush: true);
  }

  @override
  Future<void> deleteFile(List<String> segments) async {
    final file = File(_join(segments));
    if (await file.exists()) await file.delete();
  }

  @override
  Future<List<String>> listNames(List<String> segments) async {
    final dir = Directory(_join(segments));
    if (!await dir.exists()) return const [];
    return dir.list().map((e) => p.basename(e.path)).toList();
  }
}

/// Guesses a MIME type good enough for SAF's writeFileBytes -- RPG Maker
/// plugin sources are always .js (occasionally a data .json cheat file).
String _mimeTypeFor(String name) {
  if (name.toLowerCase().endsWith('.json')) return 'application/json';
  return 'text/javascript';
}

class SafGameFileSystem implements GameFileSystem {
  final Saf saf;
  final String rootUri;
  final String rootLabel;

  const SafGameFileSystem({
    required this.saf,
    required this.rootUri,
    required this.rootLabel,
  });

  @override
  String get displayPath => rootLabel;

  Future<SafDocumentFile?> _resolve(List<String> segments) async {
    if (segments.isEmpty) {
      return SafDocumentFile(
        uri: rootUri,
        name: rootLabel,
        isDir: true,
        length: 0,
        lastModified: 0,
      );
    }
    return saf.child(rootUri, segments);
  }

  @override
  Future<bool> dirExists(List<String> segments) async {
    final f = await _resolve(segments);
    return f != null && f.isDir;
  }

  @override
  Future<bool> fileExists(List<String> segments) async {
    final f = await _resolve(segments);
    return f != null && !f.isDir;
  }

  @override
  Future<Uint8List?> readFile(List<String> segments) async {
    final f = await _resolve(segments);
    if (f == null) return null;
    return saf.readFileBytes(f.uri);
  }

  @override
  Future<void> writeFile(List<String> segments, Uint8List data) async {
    final dirSegments = segments.sublist(0, segments.length - 1);
    final name = segments.last;
    final dir = dirSegments.isEmpty
        ? await _resolve(const [])
        : await saf.mkdirp(rootUri, dirSegments);
    await saf.writeFileBytes(dir!.uri, name, _mimeTypeFor(name), data, overwrite: true);
  }

  @override
  Future<void> deleteFile(List<String> segments) async {
    final f = await _resolve(segments);
    if (f != null) await saf.delete(f.uri);
  }

  @override
  Future<List<String>> listNames(List<String> segments) async {
    final dir = await _resolve(segments);
    if (dir == null || !dir.isDir) return const [];
    return (await saf.list(dir.uri)).map((f) => f.name).toList();
  }
}
