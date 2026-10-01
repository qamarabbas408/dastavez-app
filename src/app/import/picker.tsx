/**
 * Simulated PDF picker.
 *
 * A real PDF cannot become page images without a rasteriser, which this project
 * has not chosen yet, so this screen still offers invented files. It is reached
 * only from the PDF row on the Import screen, which labels it as simulated.
 *
 * No OS file picker opens and nothing on disk is read.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Banner } from '@/components/atoms/banner';
import { Button } from '@/components/atoms/button';
import { AppIcon } from '@/components/atoms/icon';
import { Screen } from '@/components/molecules/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePdfSamples, useStore } from '@/store/store';

export default function ImportPdfPickerScreen() {
  const theme = useTheme();
  const { dispatch } = useStore();
  const items = usePdfSamples();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const confirm = () => {
    const chosen = items.filter((item) => selectedIds.includes(item.id));
    if (chosen.length === 0) return;
    // The reducer owns draft construction so page labels and file type stay
    // consistent with where the pages came from.
    dispatch({ type: 'draft/startImportMany', items: chosen });
    router.push('/edit-save');
  };

  return (
    <Screen
      title="Choose a PDF"
      subtitle={`${items.length} sample files`}
      onBack={() => router.back()}>
      <Banner
        tone="info"
        title="Sample data"
        message="No file picker opens and no PDF is read. These are invented files, kept so the flow can still be reviewed until a PDF renderer is chosen."
      />

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
                  {
                    backgroundColor: isSelected ? theme.accent : 'transparent',
                    borderColor: isSelected ? theme.accent : theme.border,
                  },
                ]}>
                {isSelected ? <AppIcon name="check" size={14} color={theme.accentText} /> : null}
              </View>
              <View style={[styles.thumb, { backgroundColor: theme.backgroundSelected }]}>
                <AppIcon name="document" size={26} color={theme.textSecondary} />
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
        <Button
          label="Cancel"
          variant="secondary"
          onPress={() => router.back()}
          style={styles.footerAction}
        />
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
