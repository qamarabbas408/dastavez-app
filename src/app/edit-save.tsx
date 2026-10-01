/**
 * Edit & Save: adjust the pages, name the document, and save.
 *
 * Shared by the scan and import paths, so it reads everything from the draft in
 * the store rather than taking props.
 *
 * Saving is the point where a draft becomes real: the chosen images are copied
 * into app storage and a record is written to SQLite. Both happen here rather
 * than while picking, so abandoning a draft never leaves files or rows behind.
 *
 * The screen is laid out as a scanner editor: a fixed header, the page filling
 * whatever viewport is left, and a fixed tool bar. Two blocking states are
 * modelled: OCR failure offers Retry or Continue without OCR, and low storage
 * blocks saving. Neither discards the draft.
 */

import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner } from '@/components/atoms/banner';
import { Button } from '@/components/atoms/button';
import { ConfirmDialog } from '@/components/atoms/confirm-dialog';
import { AppIcon, type IconName } from '@/components/atoms/icon';
import { Segmented } from '@/components/atoms/segmented';
import { TextField } from '@/components/atoms/text-field';
import { IconTileGrid } from '@/components/molecules/icon-tile-grid';
import { PagePreview } from '@/components/molecules/page-preview';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { insertDocument } from '@/data/documents';
import { toDataError } from '@/data/errors';
import { newId } from '@/data/ids';
import { bakeImage } from '@/data/image-edit';
import { deletePageFile, storePageImage } from '@/data/page-store';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/store';
import type { PageFilter } from '@/store/types';
import type { NewPage } from '@/data/types';

const UNTITLED = 'Untitled document';

const FILTERS: { value: PageFilter; label: string; icon: IconName }[] = [
  { value: 'original', label: 'Original', icon: 'image' },
  { value: 'greyscale', label: 'Greyscale', icon: 'crop' },
  { value: 'highContrast', label: 'High contrast', icon: 'text' },
];

export default function EditSaveScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { state, dispatch } = useStore();
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Which editing tool is open, if any. Its options show above the toolbar. */
  const [tool, setTool] = useState<'filter' | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nextTitle, setNextTitle] = useState('');

  const draft = state.draft;

  if (!draft) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={styles.missing}>
          <Text style={[styles.missingTitle, { color: theme.text }]}>Nothing to save</Text>
          <Text style={[styles.missingBody, { color: theme.textSecondary }]}>
            This screen needs a document in progress. Start by scanning or importing.
          </Text>
          <Button label="Back to Home" variant="primary" onPress={() => router.replace('/(tabs)')} />
        </View>
      </View>
    );
  }

  const active = draft.pages.find((page) => page.id === activePageId) ?? draft.pages[0];
  const backTo = draft.origin === 'scan' ? '/scan/page-review' : '/import/source';
  const lowStorage = state.failures.lowStorage;
  const title = draft.title.trim() || UNTITLED;

  // Mock captures have no image file. Saving them would write a record whose
  // pages point at nothing, so the draft is refused instead with an explanation.
  const mockPages = draft.pages.filter((page) => !page.uri).length;
  const hasRealPages = draft.pages.length > 0 && mockPages === 0;
  const canSave = hasRealPages && !lowStorage && !saving;

  const openRename = () => {
    setNextTitle(draft.title);
    setRenaming(true);
  };

  const commitRename = () => {
    dispatch({ type: 'draft/setTitle', title: nextTitle });
    setRenaming(false);
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);

    // Track copies so a failure part-way through can be rolled back rather than
    // leaving files that no record points at.
    const copiedUris: string[] = [];

    try {
      const pages: NewPage[] = [];
      for (const [index, page] of draft.pages.entries()) {
        if (!page.uri) throw new Error(`Page ${index + 1} has no image file.`);
        // Rotation and filters are baked into the stored image, so the record
        // carries no edit state and every reader sees the finished result.
        const baked = await bakeImage(page.uri, page.rotation, page.filter);
        const uri = await storePageImage(baked, page.id);
        copiedUris.push(uri);
        pages.push({ id: page.id, uri, order: index, rotation: 0, filter: 'original' });
      }

      const id = newId('doc');
      const savedTitle = draft.title.trim() || UNTITLED;

      await insertDocument(db, {
        id,
        title: savedTitle,
        date: new Date().toISOString().slice(0, 10),
        fileType: draft.exportAsPdf ? 'pdf' : 'jpeg',
        ocrStatus: draft.ocrStatus,
        ocrText: draft.ocrText,
        pages,
      });

      dispatch({ type: 'draft/clear' });
      dispatch({ type: 'status/set', status: { tone: 'success', text: `Saved “${savedTitle}”.` } });
      router.replace({ pathname: '/document/[id]/view', params: { id } });
    } catch (error) {
      for (const uri of copiedUris) deletePageFile(uri);

      const failure = toDataError(error, 'write-failed');
      if (__DEV__) console.warn('Save failed', failure);

      dispatch({
        type: 'status/set',
        status: {
          tone: 'danger',
          text:
            failure.code === 'storage-full'
              ? 'Not enough space to save. Free some up, then try again.'
              : 'The document could not be saved. Nothing was changed.',
        },
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          {
            borderBottomColor: theme.border,
            paddingTop: insets.top + Spacing.three,
          },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => setConfirmDiscard(true)}
          hitSlop={8}
          style={styles.headerButton}>
          <AppIcon name="chevron-left" size={22} color={theme.accent} accessibilityLabel="Go back" />
        </Pressable>

        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              style={[styles.title, { color: theme.text }]}>
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Rename, currently ${title}`}
              onPress={openRename}
              hitSlop={8}
              style={styles.headerButton}>
              <AppIcon name="pencil" size={16} color={theme.textSecondary} />
            </Pressable>
          </View>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {draft.pages.length} {draft.pages.length === 1 ? 'page' : 'pages'} ·{' '}
            {draft.origin === 'scan' ? 'from scan' : 'from import'}
          </Text>
        </View>

        <Button
          label={saving ? 'Saving…' : 'Save'}
          icon="check"
          variant="primary"
          size="compact"
          disabled={!canSave}
          onPress={save}
        />
      </View>

      <View style={styles.body}>
        {draft.pages.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pagerScroll}
            contentContainerStyle={styles.pager}>
            {draft.pages.map((page, index) => {
              const isActive = page.id === active?.id;
              return (
                <Pressable
                  key={page.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`Page ${index + 1}`}
                  onPress={() => setActivePageId(page.id)}
                  style={[styles.pagerItem, { borderColor: isActive ? theme.accent : theme.border }]}>
                  <PagePreview page={page} width={72} compact />
                  <Text style={[styles.pagerLabel, { color: theme.textSecondary }]}>{index + 1}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View
          style={[
            styles.viewport,
            { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.two },
          ]}>
          {/* Notices sit over the image so the page keeps the whole viewport. */}
          <View style={styles.overlay} pointerEvents="box-none">
            {mockPages > 0 ? (
              <Banner
                tone="warning"
                title="These pages are not real images"
                message="The mock camera draws pages instead of photographing them, so there is no file to save. Import photos from this device to create a document. Scan becomes real once the camera is wired up."
              />
            ) : null}

            {draft.ocrStatus === 'failed' ? (
              <>
                <Banner
                  tone="danger"
                  title="Text recognition failed"
                  message="Nothing was recognised for this document. Retry, or save the pages without text."
                  action={{ label: 'Retry', onPress: () => dispatch({ type: 'draft/retryOcr' }) }}
                />
                <Button
                  label="Continue without text"
                  variant="secondary"
                  fullWidth
                  onPress={() => dispatch({ type: 'draft/continueWithoutOcr' })}
                />
              </>
            ) : null}

            {lowStorage ? (
              <Banner
                tone="warning"
                title="Not enough space to save"
                message="This device is low on storage. Free some up, then try saving again. Your pages are still here."
              />
            ) : null}
          </View>

          {active ? <PagePreview page={active} fill /> : null}
        </View>
      </View>

      <View
        style={[
          styles.dock,
          {
            borderTopColor: theme.border,
            backgroundColor: theme.background,
            // Clear the home indicator so the toolbar is never over it.
            paddingBottom: insets.bottom + Spacing.three,
          },
        ]}>
        <View style={styles.dockInner}>
          {/* The open tool's options sit directly above the toolbar. */}
          {tool === 'filter' && active ? (
            <Segmented
              accessibilityLabel="Page filter"
              options={FILTERS}
              value={active.filter}
              onChange={(filter) =>
                dispatch({ type: 'draft/setFilter', pageId: active.id, filter })
              }
            />
          ) : null}

          <IconTileGrid
            tiles={[
              {
                icon: 'rotate',
                label: 'Rotate',
                disabled: !active,
                onPress: () => active && dispatch({ type: 'draft/rotatePage', pageId: active.id }),
              },
              {
                icon: 'filter',
                label: 'Filter',
                selected: tool === 'filter',
                disabled: !active,
                onPress: () => setTool((current) => (current === 'filter' ? null : 'filter')),
              },
              { icon: 'crop', label: 'Crop' },
              { icon: 'text', label: 'Text' },
            ]}
          />
        </View>
      </View>

      <ConfirmDialog
        visible={confirmDiscard}
        title="Discard this draft?"
        message={`${draft.pages.length} ${draft.pages.length === 1 ? 'page' : 'pages'} and the title will be lost. Nothing has been saved.`}
        confirmLabel="Discard draft"
        destructive
        onConfirm={() => {
          dispatch({ type: 'draft/discard' });
          setConfirmDiscard(false);
          router.replace(backTo);
        }}
        onCancel={() => setConfirmDiscard(false)}
      />

      <Modal
        visible={renaming}
        transparent
        animationType="fade"
        onRequestClose={() => setRenaming(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={() => setRenaming(false)}
          style={styles.backdrop}>
          <Pressable
            // Stop taps inside the sheet from dismissing it.
            onPress={() => {}}
            style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Rename document</Text>
            <TextField
              label="Document title"
              placeholder={UNTITLED}
              value={nextTitle}
              onChangeText={setNextTitle}
              helpText="Saved on this device only."
              autoFocus
              maxLength={120}
              returnKeyType="done"
              onSubmitEditing={commitRename}
            />
            <View style={styles.sheetActions}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setRenaming(false)}
                style={styles.sheetAction}
              />
              <Button label="Rename" variant="primary" onPress={commitRename} style={styles.sheetAction} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  title: { fontSize: 20, fontWeight: '700', flexShrink: 1 },
  subtitle: { fontSize: 14 },

  body: { flex: 1 },
  pagerScroll: { flexGrow: 0, paddingHorizontal: Spacing.three },
  pager: { gap: Spacing.two, paddingVertical: Spacing.one, paddingRight: Spacing.two },
  pagerItem: {
    borderRadius: Radius.medium,
    borderWidth: 2,
    padding: Spacing.one,
    alignItems: 'center',
    gap: 2,
    minWidth: 80,
  },
  pagerLabel: { fontSize: 12, fontWeight: '700' },

  viewport: { flex: 1, alignItems: 'stretch' },
  overlay: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.three,
    right: Spacing.three,
    zIndex: 1,
    gap: Spacing.two,
  },

  dock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  dockInner: {
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  sheetActions: { flexDirection: 'row', gap: Spacing.two },
  sheetAction: { flex: 1 },

  missing: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  missingTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  missingBody: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
});
