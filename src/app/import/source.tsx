/**
 * Import: choose a source, then a mock picker.
 *
 * No OS picker is opened and no filesystem is touched. Both options lead to the
 * same in-app grid of fictional items, so the only real decision the reviewer
 * makes here is which source type they want to see.
 */

import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/atoms/icon';
import { Screen } from '@/components/molecules/screen';
import { Radius, Spacing, touchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SOURCES = [
  {
    kind: 'photos' as const,
    icon: 'image' as const,
    title: 'Photos',
    detail: 'Pick one or more pictures from this device.',
  },
  {
    kind: 'pdfs' as const,
    icon: 'document' as const,
    title: 'PDFs',
    detail: 'Add the pages of an existing PDF file.',
  },
];

export default function ImportSourceScreen() {
  const theme = useTheme();

  return (
    <Screen title="Import" subtitle="Bring in a document you already have">
      <View style={styles.list}>
        {SOURCES.map((source) => (
          <Pressable
            key={source.kind}
            accessibilityRole="button"
            accessibilityLabel={`${source.title}. ${source.detail}`}
            onPress={() => router.push({ pathname: '/import/picker', params: { kind: source.kind } })}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <View style={[styles.iconWrap, { backgroundColor: theme.accentSoft }]}>
              <AppIcon name={source.icon} size={24} color={theme.accent} />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{source.title}</Text>
              <Text style={[styles.cardDetail, { color: theme.textSecondary }]}>{source.detail}</Text>
            </View>
            <AppIcon name="chevron-right" size={18} color={theme.textSecondary} />
          </Pressable>
        ))}
      </View>

      <Text style={[styles.note, { color: theme.textSecondary }]}>
        No file picker opens in this prototype. Every item below is invented sample data.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: touchTarget.min + 12,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: Spacing.half },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardDetail: { fontSize: 14, lineHeight: 20 },
  note: { fontSize: 13, fontStyle: 'italic', lineHeight: 19 },
});
