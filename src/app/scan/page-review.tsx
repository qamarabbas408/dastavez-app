/**
 * Page Review: choose, reorder, and correct pages before saving.
 *
 * Every page here is a placeholder from the seeded pool. The screen owns two
 * pieces of local state — which page is selected, and whether the reorder
 * control is showing move buttons — both of which are pure view concerns and
 * belong in the screen rather than the store.
 *
 * Leaving with unsaved pages always asks first. Removing the last page is
 * treated as abandoning the draft and returns to the viewfinder, because a
 * document with no pages is not something Edit & Save can act on.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/atoms/button';
import { ConfirmDialog } from '@/components/atoms/confirm-dialog';
import { AppIcon } from '@/components/atoms/icon';
import { PagePreview } from '@/components/molecules/page-preview';
import { Screen } from '@/components/molecules/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/store';

export default function PageReviewScreen() {
  const theme = useTheme();
  const { state, dispatch } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(state.draft?.pages[0]?.id ?? null);
  const [reordering, setReordering] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const pages = state.draft?.pages ?? [];

  if (!state.draft) {
    // Reached without a draft (e.g. a cold deep link). Send the user somewhere
    // that makes sense rather than rendering an empty review screen.
    return (
      <Screen title="Page review">
        <Text style={{ color: theme.textSecondary }}>There are no pages to review.</Text>
        <Button label="Back to Home" variant="primary" onPress={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }

  const selected = pages.find((page) => page.id === selectedId) ?? pages[0];

  const requestBack = () => setConfirmDiscard(true);

  const removeSelected = () => {
    if (!selected) return;
    if (pages.length === 1) {
      // Last page: the draft is no longer meaningful, so abandon it outright.
      dispatch({ type: 'draft/discard' });
      router.replace('/scan/capture-preview');
      return;
    }
    const remaining = pages.filter((page) => page.id !== selected.id);
    dispatch({ type: 'draft/removePage', pageId: selected.id });
    setSelectedId(remaining[0]?.id ?? null);
  };

  const move = (pageId: string, delta: number) => {
    const from = pages.findIndex((page) => page.id === pageId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= pages.length) return;
    dispatch({ type: 'draft/reorderPages', from, to });
  };

  return (
    <Screen
      title="Review pages"
      subtitle={`${pages.length} ${pages.length === 1 ? 'page' : 'pages'} captured`}
      onBack={requestBack}>
      <View style={styles.stripBlock}>
        <View style={styles.stripHeader}>
          <Text style={[styles.stripTitle, { color: theme.text }]}>Pages</Text>
          <Button
            label={reordering ? 'Done' : 'Reorder'}
            icon="flip"
            variant="quiet"
            size="compact"
            onPress={() => setReordering((on) => !on)}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}>
          {pages.map((page, index) => {
            const isSelected = page.id === selected?.id;
            return (
              <Pressable
                key={page.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Page ${index + 1}${isSelected ? ', selected' : ''}`}
                onPress={() => setSelectedId(page.id)}
                style={[
                  styles.thumb,
                  {
                    borderColor: isSelected ? theme.accent : theme.border,
                    backgroundColor: theme.backgroundElement,
                  },
                ]}>
                <PagePreview page={page} width={92} compact />
                {reordering ? (
                  <View style={styles.reorderRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Move page ${index + 1} earlier`}
                      disabled={index === 0}
                      onPress={() => move(page.id, -1)}
                      style={styles.reorderButton}>
                      <AppIcon name="chevron-left" size={14} color={theme.text} />
                    </Pressable>
                    <Text style={[styles.reorderIndex, { color: theme.textSecondary }]}>{index + 1}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Move page ${index + 1} later`}
                      disabled={index === pages.length - 1}
                      onPress={() => move(page.id, 1)}
                      style={styles.reorderButton}>
                      <AppIcon name="chevron-right" size={14} color={theme.text} />
                    </Pressable>
                  </View>
                ) : (
                  <Text style={[styles.thumbIndex, { color: theme.textSecondary }]}>{index + 1}</Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {selected ? (
        <View style={styles.detail}>
          <PagePreview page={selected} width={180} style={{ alignSelf: 'center' }} />
          <View style={styles.detailActions}>
            <Button
              label="Rotate"
              icon="rotate"
              variant="secondary"
              size="compact"
              onPress={() => dispatch({ type: 'draft/rotatePage', pageId: selected.id })}
            />
            <Button
              label="Retake"
              icon="camera"
              variant="secondary"
              size="compact"
              onPress={() => dispatch({ type: 'draft/retakePage', pageId: selected.id })}
            />
            <Button
              label="Remove"
              icon="trash"
              variant="destructive"
              size="compact"
              onPress={removeSelected}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Button
          label="Add page"
          icon="plus"
          variant="secondary"
          fullWidth
          onPress={() => dispatch({ type: 'draft/addPage' })}
        />
        <Button
          label="Continue"
          icon="check"
          variant="primary"
          fullWidth
          onPress={() => router.push('/edit-save')}
        />
      </View>

      <ConfirmDialog
        visible={confirmDiscard}
        title="Discard these pages?"
        message={`${pages.length} ${pages.length === 1 ? 'page' : 'pages'} will be thrown away. Nothing has been saved yet.`}
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          dispatch({ type: 'draft/discard' });
          setConfirmDiscard(false);
          router.replace('/scan/capture-preview');
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stripBlock: { gap: Spacing.two },
  stripHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stripTitle: { fontSize: 17, fontWeight: '700' },
  strip: { gap: Spacing.two, paddingVertical: Spacing.one, paddingRight: Spacing.two },
  thumb: {
    borderRadius: Radius.medium,
    borderWidth: 2,
    padding: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
    minWidth: 108,
  },
  thumbIndex: { fontSize: 12, fontWeight: '700' },
  reorderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  reorderButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  reorderIndex: { fontSize: 12, fontWeight: '700' },
  detail: { alignItems: 'center', gap: Spacing.three },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'center' },
  footer: { gap: Spacing.two, paddingTop: Spacing.two },
});
