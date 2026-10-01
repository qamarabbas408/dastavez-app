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

import { router, type Href } from 'expo-router';
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
import { CropEditor } from '@/components/molecules/crop-editor';
import { PagePreview } from '@/components/molecules/page-preview';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { insertDocument, updateDocument } from '@/data/documents';
import { toDataError } from '@/data/errors';
import { newId } from '@/data/ids';
import { bakeImage } from '@/data/image-edit';
import { detectPageCorners } from '@/data/native-image';
import { deletePageFile, storePageImage } from '@/data/page-store';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/store';
import type { Draft, PageCorners, PageFilter } from '@/store/types';
import type { NewPage } from '@/data/types';

const UNTITLED = 'Untitled document';

const ORIGIN_LABEL: Record<Draft['origin'], string> = {
  scan: 'from scan',
  import: 'from import',
  edit: 'editing a saved document',
};

/**
 * Where Back and Discard land when a draft is left without saving.
 *
 * An edited document returns to its own viewer; a new draft returns to the
 * flow that started it.
 */
function backTarget(draft: Draft): Href {
  if (draft.origin === 'edit' && draft.documentId) {
    return { pathname: '/document/[id]/view', params: { id: draft.documentId } };
  }
  return draft.origin === 'scan' ? '/scan/page-review' : '/import/source';
}

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
  const [tool, setTool] = useState<'filter' | 'crop' | null>(null);
  /**
   * Crop chosen but not yet applied, in source space. Held here rather than on
   * the page so Cancel costs nothing: the draft is untouched until Apply.
   */
  const [cropQuad, setCropQuad] = useState<PageCorners | null>(null);
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
  const editingId = draft.origin === 'edit' ? draft.documentId : undefined;
  const backTo = backTarget(draft);
  /**
   * Leaving an edit goes back rather than replacing, so the viewer that pushed
   * this screen stays underneath with its own navigation intact. That viewer
   * reloads on focus, which is what picks the saved result back up.
   */
  const leave = () => (editingId && router.canGoBack() ? router.back() : router.replace(backTo));
  const lowStorage = state.failures.lowStorage;
  const title = draft.title.trim() || UNTITLED;
  const fileType = draft.exportAsPdf ? 'pdf' : 'jpeg';

  // Mock captures have no image file. Saving them would write a record whose
  // pages point at nothing, so the draft is refused instead with an explanation.
  const mockPages = draft.pages.filter((page) => !page.uri).length;
  const hasRealPages = draft.pages.length > 0 && mockPages === 0;
  const canSave = hasRealPages && !lowStorage && !saving && tool !== 'crop';

  const openRename = () => {
    setNextTitle(draft.title);
    setRenaming(true);
  };

  const commitRename = () => {
    dispatch({ type: 'draft/setTitle', title: nextTitle });
    setRenaming(false);
  };

  /**
   * Open the crop tool on a page that has not been cropped yet, seeding the
   * corners from a native edge detect. Existing corners win over a fresh detect
   * so reopening the tool keeps what the user already chose, and a late detect
   * never overwrites corners the user dragged in the meantime.
   */
  const startCrop = () => {
    if (!active?.uri) return;
    const uri = active.uri;
    setCropQuad(active.corners ?? null);
    setTool('crop');
    if (active.corners) return;

    detectPageCorners(uri)
      .then((found) => {
        if (found) setCropQuad((current) => current ?? found);
      })
      .catch((error: unknown) => {
        if (__DEV__) console.warn('Corner detection failed', error);
      });
  };

  /** Cropping is a scratch layer; closing it simply throws the pending quad away. */
  const closeCrop = () => {
    setTool(null);
    setCropQuad(null);
  };

  const applyCrop = () => {
    if (!active) return;
    dispatch({ type: 'draft/setCorners', pageId: active.id, corners: cropQuad });
    closeCrop();
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);

    // Files written by this attempt, so a failure part-way through can be
    // rolled back rather than leaving files that no record points at. Files
    // this attempt replaced are tracked separately: they are only unreachable
    // once the write has actually committed.
    const createdUris: string[] = [];
    const staleUris: string[] = [];
    let committed = false;

    try {
      const pages: NewPage[] = [];
      for (const [index, page] of draft.pages.entries()) {
        if (!page.uri) throw new Error(`Page ${index + 1} has no image file.`);
        // Crop, rotation and filters are baked into the stored image, so the
        // record carries no edit state and every reader sees the finished result.
        const baked = await bakeImage(page.uri, page.rotation, page.filter, page.corners);

        let id = page.id;
        let uri: string;

        if (editingId && baked === page.uri) {
          // Nothing to re-bake, so the record already points at the right file.
          uri = page.uri;
        } else {
          // An edit writes beside the old file rather than over it. The record
          // only moves once every page is done, and a fresh path is what makes
          // the viewer read the new bytes instead of the ones it has cached.
          if (editingId) id = newId('page');
          uri = await storePageImage(baked, id);
          createdUris.push(uri);
          if (editingId) staleUris.push(page.uri);
        }

        pages.push({ id, uri, order: index, rotation: 0, filter: 'original' });
      }

      const savedTitle = draft.title.trim() || UNTITLED;
      const documentId = editingId ?? newId('doc');

      if (editingId) {
        await updateDocument(db, {
          id: documentId,
          title: savedTitle,
          fileType,
          ocrStatus: draft.ocrStatus,
          ocrText: draft.ocrText,
          pages,
        });
      } else {
        await insertDocument(db, {
          id: documentId,
          title: savedTitle,
          date: new Date().toISOString().slice(0, 10),
          fileType,
          ocrStatus: draft.ocrStatus,
          ocrText: draft.ocrText,
          pages,
        });
      }
      committed = true;

      dispatch({ type: 'draft/clear' });
      dispatch({ type: 'status/set', status: { tone: 'success', text: `Saved “${savedTitle}”.` } });

      if (editingId) leave();
      else router.replace({ pathname: '/document/[id]/view', params: { id: documentId } });
    } catch (error) {
      const failure = toDataError(error, 'write-failed');
      if (__DEV__) console.warn('Save failed', failure);

      dispatch({
        type: 'status/set',
        status: {
          tone: 'danger',
          text:
            failure.code === 'storage-full'
              ? 'Not enough space to save. Free some up, then try again.'
              : editingId
                ? 'Your changes could not be saved. The document is untouched.'
                : 'The document could not be saved. Nothing was changed.',
        },
      });
    } finally {
      // Committed: the record moved on, so the replaced files are orphans.
      // Not committed: the fresh files are the orphans, and the old ones are
      // still what the record describes.
      for (const uri of committed ? staleUris : createdUris) deletePageFile(uri);
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
            {ORIGIN_LABEL[draft.origin]}
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
        {/* Cropping owns the whole viewport, so the page strip steps aside. */}
        {draft.pages.length > 1 && tool !== 'crop' ? (
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
            {tool !== 'crop' && mockPages > 0 ? (
              <Banner
                tone="warning"
                title="These pages are not real images"
                message="The mock camera draws pages instead of photographing them, so there is no file to save. Import photos from this device to create a document. Scan becomes real once the camera is wired up."
              />
            ) : null}

            {tool !== 'crop' && draft.ocrStatus === 'failed' ? (
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

            {tool !== 'crop' && lowStorage ? (
              <Banner
                tone="warning"
                title="Not enough space to save"
                message="This device is low on storage. Free some up, then try saving again. Your pages are still here."
              />
            ) : null}
          </View>

          {tool === 'crop' && active?.uri ? (
            <CropEditor
              uri={active.uri}
              rotation={active.rotation}
              corners={cropQuad ?? undefined}
              onChange={setCropQuad}
            />
          ) : active ? (
            // Remounting per page starts any zoom over; changing the filter
            // keeps it, so the same region can be compared across treatments.
            <PagePreview key={active.id} page={active} fill zoomable />
          ) : null}
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
          {tool === 'crop' ? (
            <View style={styles.cropActions}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={closeCrop}
                style={styles.cropAction}
              />
              <Button
                label="Apply"
                icon="check"
                variant="primary"
                onPress={applyCrop}
                style={styles.cropAction}
              />
            </View>
          ) : (
            <>
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
                  {
                    icon: 'crop',
                    label: 'Crop',
                    disabled: !active?.uri,
                    onPress: startCrop,
                  },
                  { icon: 'text', label: 'Text' },
                ]}
              />
            </>
          )}
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
          leave();
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
  cropActions: { flexDirection: 'row', gap: Spacing.two },
  cropAction: { flex: 1 },

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
