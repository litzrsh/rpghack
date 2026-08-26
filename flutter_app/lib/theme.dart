/// Cyberpunk cyan/crimson theme, carried over from the original browser
/// installer's look (index.html's ":root" custom properties) into Material.
library;

import 'package:flutter/material.dart';

class AppColors {
  static const bg = Color(0xFF121214);
  static const panel = Color(0xFF1A1A1E);
  static const panelBorder = Color(0xFF2A2A30);
  static const inputBg = Color(0xFF0D0D0F);
  static const cyan = Color(0xFF00F0FF);
  static const blue = Color(0xFF0066FF);
  static const green = Color(0xFF39FF14);
  static const red = Color(0xFFFF3B5C);
  static const crimson = Color(0xFFFF0055);
  static const text = Color(0xFFD8F8FF);
  static const textDim = Color(0xFF7A8A90);
}

ThemeData buildAppTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: AppColors.bg,
    colorScheme: base.colorScheme.copyWith(
      primary: AppColors.cyan,
      secondary: AppColors.crimson,
      surface: AppColors.panel,
      error: AppColors.red,
    ),
    textTheme: base.textTheme.apply(
      fontFamily: 'monospace',
      bodyColor: AppColors.text,
      displayColor: AppColors.cyan,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.inputBg,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: const BorderSide(color: AppColors.panelBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: const BorderSide(color: AppColors.panelBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: const BorderSide(color: AppColors.cyan, width: 2),
      ),
      hintStyle: const TextStyle(color: AppColors.textDim),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected) ? AppColors.cyan : AppColors.textDim,
      ),
      trackColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? AppColors.cyan.withValues(alpha: 0.25)
            : AppColors.panelBorder,
      ),
    ),
  );
}
