/**
 * Edit & Save: adjust the pages, name the document, choose a format, and save.
 *
 * Shared by the scan and import paths, so it reads everything from the draft in
 * the store rather than taking props.
 *
 * Saving is the point where a draft becomes real: the chosen images are copied
 * into app storage and a record is written to SQLite. Both happen here rather
 * than while picking, so abandoning a draft never leaves files or rows behind.
 *
 * Two blocking states are modelled: OCR failure offers Retry or Continue
 * without OCR, and low storage blocks saving. Neither discards the draft.
 */

import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner } from '@/components/atoms/banner';
import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { ConfirmDialog } from '@/components/atoms/confirm-dialog';
import { AppIcon, type IconName } from '@/components/atoms/icon';
import { Segmented } from '@/components/atoms/segmented';
import { TextField } from '@/components/atoms/text-field';
import { PagePreview } from '@/components/molecules/page-preview';
import { MaxContentWidth, Radius, Spacing, touchTarget } from '@/constants/theme';
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

  // Mock captures have no image file. Saving them would write a record whose
  // pages point at nothing, so the draft is refused instead with an explanation.
  const mockPages = draft.pages.filter((page) => !page.uri).length;
  const hasRealPages = draft.pages.length > 0 && mockPages === 0;
  const canSave = hasRealPages && !lowStorage && !saving;

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
      const title = draft.title.trim() || UNTITLED;

      await insertDocument(db, {
        id,
        title,
        date: new Date().toISOString().slice(0, 10),
        fileType: draft.exportAsPdf ? 'pdf' : 'jpeg',
        ocrStatus: draft.ocrStatus,
        ocrText: draft.ocrText,
        pages,
      });

      dispatch({ type: 'draft/clear' });
      dispatch({ type: 'status/set', status: { tone: 'success', text: `Saved “${title}”.` } });
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
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
            Edit &amp; save
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {draft.pages.length} {draft.pages.length === 1 ? 'page' : 'pages'} ·{' '}
            {draft.origin === 'scan' ? 'from scan' : 'from import'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {draft.pages.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
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

        {active ? (
          <View style={styles.previewBlock}>
            <PagePreview page={active} width={200} style={{ alignSelf: 'center' }} />
            <View style={styles.adjustRow}>
              <Button
                label="Rotate"
                icon="rotate"
                size="compact"
                onPress={() => dispatch({ type: 'draft/rotatePage', pageId: active.id })}
              />
            </View>
            <Segmented
              accessibilityLabel="Page filter"
              options={FILTERS}
              value={active.filter}
              onChange={(filter) => dispatch({ type: 'draft/setFilter', pageId: active.id, filter })}
            />
          </View>
        ) : null}

        <TextField
          label="Document title"
          placeholder={UNTITLED}
          value={draft.title}
          onChangeText={(title) => dispatch({ type: 'draft/setTitle', title })}
          helpText="Saved on this device only."
        />

        <Card>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={[styles.switchTitle, { color: theme.text }]}>Save as a single PDF</Text>
              <Text style={[styles.switchBody, { color: theme.textSecondary }]}>
                {draft.pages.length === 1
                  ? 'A single page is also valid as a PDF.'
                  : `Combines all ${draft.pages.length} pages into one file.`}
              </Text>
            </View>
            <Switch
              value={draft.exportAsPdf}
              onValueChange={(exportAsPdf) =>
                dispatch({ type: 'draft/setExportFormat', exportAsPdf })
              }
              accessibilityLabel="Save as a single PDF"
              trackColor={{ true: theme.accent, false: theme.border }}
            />
          </View>
        </Card>

        <Card>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={[styles.switchTitle, { color: theme.text }]}>English text recognition</Text>
              <Text style={[styles.switchBody, { color: theme.textSecondary }]}>
                {draft.ocrEnabled
                  ? 'Makes the text in each page selectable later.'
                  : 'Off. No text will be recognised for this document.'}
              </Text>
            </View>
            <Switch
              value={draft.ocrEnabled}
              onValueChange={(enabled) => dispatch({ type: 'draft/setOcrEnabled', enabled })}
              accessibilityLabel="English text recognition"
              trackColor={{ true: theme.accent, false: theme.border }}
            />
          </View>
        </Card>

        {mockPages > 0 ? (
          <Banner
            tone="warning"
            title="These pages are not real images"
            message="The mock camera draws pages instead of photographing them, so there is no file to save. Import photos from this device to create a document. Scan becomes real once the camera is wired up."
          />
        ) : null}

        {draft.ocrStatus === 'failed' ? (
          <Banner
            tone="danger"
            title="Text recognition failed"
            message="Nothing was recognised for this document. Retry, or save the pages without text."
            action={{ label: 'Retry', onPress: () => dispatch({ type: 'draft/retryOcr' }) }}
          />
        ) : null}

        {draft.ocrStatus === 'failed' ? (
          <Button
            label="Continue without text"
            variant="secondary"
            fullWidth
            onPress={() => dispatch({ type: 'draft/continueWithoutOcr' })}
          />
        ) : null}

        {draft.ocrEnabled && draft.ocrStatus === 'complete' ? (
          <Banner
            tone="success"
            title="Text recognised"
            message="Sample text is ready on the document."
          />
        ) : null}

        {!draft.ocrEnabled ? (
          <Banner
            tone="info"
            title="Text recognition off"
            message="The document will be saved as images only."
          />
        ) : null}

        {lowStorage ? (
          <Banner
            tone="warning"
            title="Not enough space to save"
            message="This device is low on storage. Free some up, then try saving again. Your pages are still here."
          />
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: theme.border,
            backgroundColor: theme.background,
            // Clear the home indicator so Save is never sitting on top of it.
            paddingBottom: insets.bottom + Spacing.three,
          },
        ]}>
        <Button
          label="Cancel"
          variant="secondary"
          onPress={() => setConfirmDiscard(true)}
          style={styles.footerAction}
        />
        <Button
          label={saving ? 'Saving…' : 'Save document'}
          icon="check"
          variant="primary"
          disabled={!canSave}
          onPress={save}
          style={styles.footerAction}
        />
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
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 14 },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
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
  previewBlock: { gap: Spacing.three, alignItems: 'center' },
  adjustRow: { flexDirection: 'row', gap: Spacing.two },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: touchTarget.min,
  },
  switchText: { flex: 1, gap: Spacing.one },
  switchTitle: { fontSize: 16, fontWeight: '600' },
  switchBody: { fontSize: 14, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerAction: { flex: 1 },
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
