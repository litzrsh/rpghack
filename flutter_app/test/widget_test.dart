import 'package:flutter_test/flutter_test.dart';

import 'package:cheat_installer/main.dart';

void main() {
  testWidgets('App boots and shows the header', (WidgetTester tester) async {
    await tester.pumpWidget(const CheatInstallerApp());
    await tester.pump();

    expect(find.text('RPG MAKER UNIFIED CHEAT INSTALLER'), findsOneWidget);
  });
}
