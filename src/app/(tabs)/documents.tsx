/**
 * All Documents — placeholder tab.
 *
 * Home already lists the most recent documents. This tab will hold the full
 * library with filtering once it is built; for now it only explains itself.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function DocumentsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top + Spacing.three,
          paddingBottom: BottomTabInset + Spacing.four,
        },
      ]}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
        All Documents
      </Text>
      <Text style={[styles.body, { color: theme.textSecondary }]}>
        The full library will live here, with filtering by type and date. Home shows the most recent
        documents in the meantime.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  title: { fontSize: 30, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
});
