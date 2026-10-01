/**
 * Mock picker for Photos or PDFs, chosen by the `kind` route param.
 *
 * The grid is a real selection surface — tap to select, Cancel to abandon, Select
 * to create a draft — but every row is invented. Nothing is read from disk.
 *
 * Multi-select is allowed for photos so the reviewer can reach a multi-page
 * import in one pass; the draft is still built by the reducer, not here.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/atoms/button';
import { AppIcon } from '@/components/atoms/icon';
import { Screen } from '@/components/molecules/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSourceItems, useStore } from '@/store/store';
import type { SourceKind } from '@/store/types';

export default function ImportPickerScreen() {
  const theme = useTheme();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const { dispatch } = useStore();

  // An unknown param should not crash the screen; fall back to photos.
  const source: SourceKind = kind === 'pdfs' ? 'pdfs' : 'photos';
  const items = useSourceItems(source);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const confirm = () => {
    const chosen = items.filter((item) => selectedIds.includes(item.id));
    if (chosen.length === 0) return;
    // The reducer owns draft construction so page labels and file type stay
    // consistent with where the pages actually came from.
    dispatch({ type: 'draft/startImportMany', items: chosen });
    router.replace('/edit-save');
  };

  return (
    <Screen
      title={source === 'pdfs' ? 'Choose a PDF' : 'Choose photos'}
      subtitle={`${items.length} sample ${source === 'pdfs' ? 'files' : 'photos'}`}
      onBack={() => router.back()}>
      <View style={styles.grid}>
        {items.map((item) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${item.title}. ${item.subtitle}`}
              onPress={() => toggle(item.id)}
              style={[
                styles.item,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: isSelected ? theme.accent : theme.border,
                },
              ]}>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: isSelected ? theme.accent : 'transparent', borderColor: isSelected ? theme.accent : theme.border },
                ]}>
                {isSelected ? <AppIcon name="check" size={14} color={theme.accentText} /> : null}
              </View>
              <View style={[styles.thumb, { backgroundColor: theme.backgroundSelected }]}>
                <AppIcon name={source === 'pdfs' ? 'document' : 'image'} size={26} color={theme.textSecondary} />
              </View>
              <View style={styles.itemText}>
                <Text numberOfLines={2} style={[styles.itemTitle, { color: theme.text }]}>
                  {item.title}
                </Text>
                <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                  {item.subtitle} · {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Button label="Cancel" variant="secondary" onPress={() => router.back()} style={styles.footerAction} />
        <Button
          label={selectedIds.length > 1 ? `Select ${selectedIds.length}` : 'Select'}
          variant="primary"
          disabled={selectedIds.length === 0}
          onPress={confirm}
          style={styles.footerAction}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: Spacing.two },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: 2,
    padding: Spacing.three,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { flex: 1, gap: Spacing.half },
  itemTitle: { fontSize: 15, fontWeight: '600' },
  itemMeta: { fontSize: 13 },
  footer: { flexDirection: 'row', gap: Spacing.two },
  footerAction: { flex: 1 },
});
