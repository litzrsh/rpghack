import 'dart:io';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:saf/saf.dart';

import 'cheat_library.dart';
import 'game_fs.dart';
import 'installer_service.dart';
import 'models.dart';
import 'theme.dart';
import 'widgets/engine_badge.dart';
import 'widgets/terminal_console.dart';

/// Sentinel dropdown value that switches the cheat selector into manual
/// Game-ID entry mode, kept out of the normal cheat-id value space.
const _manualOptionValue = '__manual__';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _installer = const InstallerService();
  final _saf = Saf();
  final _manualIdController = TextEditingController();
  final _windowsPathController = TextEditingController();

  // Windows target
  String? _windowsPath;

  // Android target
  String? _androidRootUri;
  String? _androidRootLabel;
  List<SafPersistedPermission> _androidRecents = const [];

  EngineDetection? _detected;
  bool _detecting = false;

  List<CheatSource> _cheatSources = [];
  String _selectedCheatValue = '';
  bool _backupEnabled = true;

  bool _busy = false;
  final List<LogLine> _lines = [];

  bool get _isAndroid => !kIsWeb && Platform.isAndroid;
  bool get _isWindows => !kIsWeb && Platform.isWindows;

  GameFileSystem? get _fs {
    if (_isWindows && _windowsPath != null && _windowsPath!.trim().isNotEmpty) {
      return WindowsGameFileSystem(_windowsPath!.trim());
    }
    if (_isAndroid && _androidRootUri != null) {
      return SafGameFileSystem(saf: _saf, rootUri: _androidRootUri!, rootLabel: _androidRootLabel ?? _androidRootUri!);
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    _loadCheatSources();
    if (_isAndroid) _loadAndroidRecents();
  }

  @override
  void dispose() {
    _manualIdController.dispose();
    _windowsPathController.dispose();
    super.dispose();
  }

  void _log(String message, LogKind kind) {
    setState(() => _lines.add(LogLine(message, kind)));
  }

  Future<void> _loadCheatSources() async {
    final sources = await scanCheatSources();
    if (!mounted) return;
    setState(() => _cheatSources = sources);
    if (sources.isEmpty) {
      _log('No cheat files found -- import one, or use manual entry below.', LogKind.system);
    } else {
      _log('Loaded ${sources.length} cheat file(s).', LogKind.system);
    }
  }

  Future<void> _loadAndroidRecents() async {
    final recents = await _saf.persistedPermissions();
    if (!mounted) return;
    setState(() => _androidRecents = recents);
  }

  Future<void> _runDetect() async {
    final fs = _fs;
    if (fs == null) {
      setState(() => _detected = null);
      return;
    }
    setState(() => _detecting = true);
    final detected = await detectEngine(fs);
    if (!mounted) return;
    setState(() {
      _detected = detected;
      _detecting = false;
    });
  }

  Future<void> _pickWindowsFolder() async {
    final path = await FilePicker.getDirectoryPath();
    if (path == null) return;
    setState(() {
      _windowsPath = path;
      _windowsPathController.text = path;
    });
    await _runDetect();
  }

  Future<void> _pickAndroidFolder() async {
    final dir = await _saf.pickDirectory();
    if (dir == null) return;
    setState(() {
      _androidRootUri = dir.uri;
      _androidRootLabel = dir.name;
    });
    await _loadAndroidRecents();
    await _runDetect();
  }

  Future<void> _useAndroidRecent(SafPersistedPermission perm) async {
    setState(() {
      _androidRootUri = perm.uri;
      _androidRootLabel = Uri.decodeComponent(perm.uri.split('/').last);
    });
    await _runDetect();
  }

  Future<void> _importCheatFile() async {
    final picked = await FilePicker.pickFile(
      type: FileType.custom,
      allowedExtensions: ['js', 'json'],
    );
    if (picked == null) return;
    final Uint8List bytes;
    try {
      bytes = await picked.readAsBytes();
    } catch (_) {
      _log('Could not read the selected file.', LogKind.error);
      return;
    }
    final error = await importCheatFile(picked.name, bytes);
    if (error != null) {
      _log(error, LogKind.error);
      return;
    }
    _log('Imported cheat file: ${picked.name}', LogKind.system);
    await _loadCheatSources();
  }

  bool get _manualMode => _selectedCheatValue == _manualOptionValue;

  bool get _manualIdReserved {
    if (!_manualMode) return false;
    final id = _manualIdController.text.trim();
    return id.isNotEmpty && isReservedId(id);
  }

  CheatSource? get _selectedCheatSource {
    if (_manualMode || _selectedCheatValue.isEmpty) return null;
    for (final source in _cheatSources) {
      if (source.fileName == _selectedCheatValue) return source;
    }
    return null;
  }

  Future<void> _inject() async {
    final fs = _fs;
    if (fs == null) {
      _log('Please select a target game folder first.', LogKind.error);
      return;
    }
    if (_manualIdReserved) {
      _log('Cannot inject: the entered Game ID is a reserved system keyword.', LogKind.error);
      return;
    }
    setState(() => _busy = true);
    _log('Starting injection...', LogKind.system);
    try {
      final outcome = await _installer.inject(
        fs: fs,
        selectedCheat: _selectedCheatSource,
        manualId: _manualMode ? _manualIdController.text.trim() : null,
        backupEnabled: _backupEnabled,
        log: _log,
      );
      _log(
        'Installation finished successfully (${outcome.engine?.label}'
        '${outcome.cheatFile != null ? ", cheat: ${outcome.cheatFile}" : ""}).',
        LogKind.success,
      );
      if (_manualMode) {
        _manualIdController.clear();
        await _loadCheatSources();
      }
    } catch (e) {
      _log('$e', LogKind.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _uninstall() async {
    final fs = _fs;
    if (fs == null) {
      _log('Please select a target game folder first.', LogKind.error);
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.panel,
        title: const Text('Uninstall Cheat Engine?'),
        content: Text('This will remove Cheat Engine from:\n\n${fs.displayPath}'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Continue')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busy = true);
    _log('Starting uninstall...', LogKind.system);
    try {
      final outcome = await _installer.uninstall(fs: fs, log: _log);
      _log('Uninstall finished successfully (${outcome.engine?.label}).', LogKind.success);
    } catch (e) {
      _log('$e', LogKind.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1100),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildHeader(),
                const SizedBox(height: 28),
                _buildControlGrid(context),
                const SizedBox(height: 24),
                _buildActionButtons(),
                const SizedBox(height: 28),
                TerminalConsole(lines: _lines, busy: _busy),
                const SizedBox(height: 16),
                const Text(
                  'RPG Maker Unified Cheat Installer -- Windows & Android',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textDim, fontSize: 11),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      runSpacing: 12,
      children: [
        const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'RPG MAKER UNIFIED CHEAT INSTALLER',
              style: TextStyle(color: AppColors.cyan, fontSize: 20, fontWeight: FontWeight.bold, letterSpacing: 1),
            ),
            SizedBox(height: 4),
            Text(
              'CheatEngine_Core / CheatEngine_UI installer',
              style: TextStyle(color: AppColors.textDim, fontSize: 12),
            ),
          ],
        ),
        _detecting
            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
            : EngineBadge(state: badgeStateForEngine(_detected?.engine, _fs != null)),
      ],
    );
  }

  Widget _buildControlGrid(BuildContext context) {
    final isWide = MediaQuery.of(context).size.width > 720;
    final directoryPanel = _buildDirectoryPanel();
    final cheatPanel = _buildCheatPanel();
    if (isWide) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: directoryPanel),
          const SizedBox(width: 20),
          Expanded(child: cheatPanel),
        ],
      );
    }
    return Column(
      children: [
        directoryPanel,
        const SizedBox(height: 20),
        cheatPanel,
      ],
    );
  }

  Widget _panel({required String title, required Widget child}) {
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
          Text(
            title,
            style: const TextStyle(color: AppColors.cyan, fontSize: 12, letterSpacing: 2, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }

  Widget _buildDirectoryPanel() {
    return _panel(
      title: 'DIRECTORY SETUP',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_isWindows) ...[
            const Text('Target game folder path', style: TextStyle(color: AppColors.textDim, fontSize: 12)),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _windowsPathController,
                    style: const TextStyle(fontSize: 13),
                    decoration: const InputDecoration(
                      hintText: r'C:\Games\MyRpgMakerProject',
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                    onChanged: (value) {
                      _windowsPath = value;
                      _runDetect();
                    },
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(onPressed: _pickWindowsFolder, child: const Text('Browse...')),
              ],
            ),
            const SizedBox(height: 6),
            const Text(
              'Folder containing either "www/" (MV) or "js/" (MZ) directly.',
              style: TextStyle(color: AppColors.textDim, fontSize: 11),
            ),
          ] else if (_isAndroid) ...[
            const Text('Target game folder', style: TextStyle(color: AppColors.textDim, fontSize: 12)),
            const SizedBox(height: 6),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.inputBg,
                border: Border.all(color: AppColors.panelBorder),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                _androidRootLabel ?? 'No folder selected',
                style: TextStyle(color: _androidRootLabel != null ? AppColors.text : AppColors.textDim, fontSize: 13),
              ),
            ),
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: _pickAndroidFolder,
              icon: const Icon(Icons.folder_open),
              label: const Text('Select Game Folder (SAF)'),
            ),
            if (_androidRecents.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Text('Recently granted folders', style: TextStyle(color: AppColors.textDim, fontSize: 11)),
              const SizedBox(height: 6),
              ..._androidRecents.map(
                (perm) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: OutlinedButton(
                    onPressed: () => _useAndroidRecent(perm),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        Uri.decodeComponent(perm.uri.split('/').last),
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ] else
            const Text(
              'Unsupported platform for game-folder selection.',
              style: TextStyle(color: AppColors.red, fontSize: 12),
            ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.inputBg,
              border: Border.all(color: AppColors.panelBorder),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Expanded(
                  child: Text('Enable Safe Backup (plugins.js.bak)', style: TextStyle(fontSize: 13)),
                ),
                Switch(
                  value: _backupEnabled,
                  onChanged: (value) => setState(() => _backupEnabled = value),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCheatPanel() {
    final items = <DropdownMenuItem<String>>[
      const DropdownMenuItem(value: '', child: Text('-- Core engine only --')),
      ..._cheatSources.map(
        (s) => DropdownMenuItem(value: s.fileName, child: Text(s.installedFileName, overflow: TextOverflow.ellipsis)),
      ),
      const DropdownMenuItem(value: _manualOptionValue, child: Text('[ + Register New Game ID (Manual Entry) ]')),
    ];

    return _panel(
      title: 'CHEAT FILE SELECTOR',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Custom cheat / Game ID', style: TextStyle(color: AppColors.textDim, fontSize: 12)),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            initialValue: _selectedCheatValue,
            isExpanded: true,
            dropdownColor: AppColors.panel,
            decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
            items: items,
            onChanged: (value) => setState(() => _selectedCheatValue = value ?? ''),
          ),
          const SizedBox(height: 6),
          const Text(
            'Pick a cheat file, or choose manual entry to register a new Game ID.',
            style: TextStyle(color: AppColors.textDim, fontSize: 11),
          ),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: _importCheatFile,
              icon: const Icon(Icons.upload_file, size: 18),
              label: const Text('Import cheat file...'),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 200),
            child: _manualMode
                ? Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text('Direct Game ID', style: TextStyle(color: AppColors.textDim, fontSize: 12)),
                        const SizedBox(height: 6),
                        TextField(
                          controller: _manualIdController,
                          style: const TextStyle(fontSize: 13),
                          decoration: const InputDecoration(
                            hintText: 'Steam_123450',
                            isDense: true,
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          ),
                          onChanged: (_) => setState(() {}),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Generates a skeleton cheat tab, installed as CheatEngine_{ID}.js.',
                          style: TextStyle(color: AppColors.textDim, fontSize: 11),
                        ),
                        if (_manualIdReserved)
                          const Padding(
                            padding: EdgeInsets.only(top: 6),
                            child: Text(
                              '⚠️ "Core" and "UI" are reserved system keywords. Please use a unique Game ID.',
                              style: TextStyle(color: AppColors.crimson, fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                          ),
                      ],
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons() {
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: 20,
      runSpacing: 12,
      children: [
        FilledButton(
          onPressed: (_busy || _manualIdReserved) ? null : _inject,
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.cyan,
            foregroundColor: const Color(0xFF04181A),
            padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 18),
            textStyle: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1.5),
          ),
          child: const Text('[ INJECT CHEAT ENGINE ]'),
        ),
        FilledButton(
          onPressed: _busy ? null : _uninstall,
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.crimson,
            foregroundColor: const Color(0xFF1A0006),
            padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 18),
            textStyle: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1.5),
          ),
          child: const Text('[ UNINSTALL CHEAT ENGINE ]'),
        ),
      ],
    );
  }
}
