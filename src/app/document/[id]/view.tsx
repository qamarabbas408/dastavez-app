/**
 * Document View: pages, recognised text, and the export/delete actions.
 *
 * The Preview / Text switch is local view state, not document state — switching
 * tabs should never be treated as an edit. Which panel is meaningful depends on
 * the document's `ocrStatus`, so the empty and error cases are shown in place
 * rather than as a separate screen.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Banner } from '@/components/atoms/banner';
import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { ConfirmDialog } from '@/components/atoms/confirm-dialog';
import { Segmented } from '@/components/atoms/segmented';
import { PagePreview } from '@/components/molecules/page-preview';
import { Screen } from '@/components/molecules/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/store';

type Panel = 'preview' | 'text';

export default function DocumentViewScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useStore();
  const [panel, setPanel] = useState<Panel>('preview');
  const [pageIndex, setPageIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const document = state.documents.find((doc) => doc.id === id);

  if (!document) {
    return (
      <Screen title="Document" onBack={() => router.replace('/(tabs)')}>
        <Text style={{ color: theme.textSecondary }}>
          That document is no longer in the library. It may have been deleted.
        </Text>
        <Button label="Back to Home" variant="primary" onPress={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }

  const page = document.pages[Math.min(pageIndex, document.pages.length - 1)];

  return (
    <Screen
      title={document.title}
      subtitle={`${document.pages.length} ${document.pages.length === 1 ? 'page' : 'pages'} · ${document.fileType.toUpperCase()}`}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
      <Segmented
        accessibilityLabel="Document view mode"
        options={[
          { value: 'preview', label: 'Preview', icon: 'image' },
          { value: 'text', label: 'Text', icon: 'text' },
        ]}
        value={panel}
        onChange={setPanel}
      />

      {panel === 'preview' ? (
        <View style={styles.previewBlock}>
          {page ? <PagePreview page={page} width={240} style={{ alignSelf: 'center' }} /> : null}

          {document.pages.length > 1 ? (
            <View style={styles.pager}>
              <Button
                label="Previous"
                variant="secondary"
                size="compact"
                disabled={pageIndex === 0}
                onPress={() => setPageIndex((index) => Math.max(0, index - 1))}
              />
              <Text accessibilityLiveRegion="polite" style={[styles.pagerLabel, { color: theme.textSecondary }]}>
                Page {pageIndex + 1} of {document.pages.length}
              </Text>
              <Button
                label="Next"
                variant="secondary"
                size="compact"
                disabled={pageIndex >= document.pages.length - 1}
                onPress={() => setPageIndex((index) => Math.min(document.pages.length - 1, index + 1))}
              />
            </View>
          ) : null}
        </View>
      ) : document.ocrStatus === 'unavailable' ? (
        <Card>
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No recognised text</Text>
            <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
              Text recognition was turned off for this document, so there is nothing to show. The pages
              are still stored as images.
            </Text>
          </View>
        </Card>
      ) : document.ocrStatus === 'failed' ? (
        <Banner
          tone="danger"
          title="Text recognition failed"
          message="Nothing was recognised for this document. The pages can still be exported as images."
        />
      ) : document.ocrStatus === 'pending' ? (
        <Banner tone="info" title="Text is being recognised" message="This normally takes a moment." />
      ) : (
        <Card>
          <Text style={[styles.textLabel, { color: theme.textSecondary }]}>Recognised text</Text>
          <Text selectable style={[styles.ocrText, { color: theme.text }]}>
            {document.ocrText}
          </Text>
        </Card>
      )}

      <View style={styles.actions}>
        <Button
          label="Export PDF"
          icon="share"
          variant="primary"
          fullWidth
          onPress={() =>
            router.push({ pathname: '/document/[id]/export-confirm', params: { id: document.id, format: 'pdf' } })
          }
        />
        <Button
          label="Export JPEG"
          icon="image"
          variant="secondary"
          fullWidth
          onPress={() =>
            router.push({ pathname: '/document/[id]/export-confirm', params: { id: document.id, format: 'jpeg' } })
          }
        />
        <Button label="Delete document" icon="trash" variant="destructive" fullWidth onPress={() => setConfirmDelete(true)} />
        <Button label="Back to Home" variant="quiet" fullWidth onPress={() => router.replace('/(tabs)')} />
      </View>

      <ConfirmDialog
        visible={confirmDelete}
        title={`Delete “${document.title}”?`}
        message={`All ${document.pages.length} ${document.pages.length === 1 ? 'page' : 'pages'} will be removed from this device. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          dispatch({ type: 'document/delete', id: document.id });
          setConfirmDelete(false);
          router.replace('/(tabs)');
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  previewBlock: { gap: Spacing.three },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  pagerLabel: { fontSize: 14, fontWeight: '600' },
  emptyState: { gap: Spacing.two, paddingVertical: Spacing.two },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBody: { fontSize: 14, lineHeight: 20 },
  textLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: Spacing.two },
  ocrText: { fontSize: 15, lineHeight: 23 },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
});
