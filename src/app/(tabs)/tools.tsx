/**
 * Tools — placeholder tab.
 *
 * Lists everything Dastavez intends to offer. None of the tools is built yet,
 * so the grid is presentation only apart from tiles that carry a destination.
 */

import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ToolGrid } from '@/components/molecules/tool-grid';
import { ALL_TOOLS } from '@/constants/tools';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ToolsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.three, paddingBottom: BottomTabInset + Spacing.four },
      ]}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
        Tools
      </Text>
      <Text style={[styles.body, { color: theme.textSecondary }]}>
        Everything Dastavez will be able to do, in one place. None of these is built yet.
      </Text>
      <ToolGrid tools={ALL_TOOLS} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  title: { fontSize: 30, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, marginTop: -Spacing.two },
});
