/**
 * Home: stored documents, search, and the two ways in (Scan, Import).
 *
 * This is a tab root, so it has no back affordance and sits above the native tab
 * bar. The tab bar reserves its own space, so content only pads for the bottom
 * safe area.
 *
 * The list is read from SQLite. Because documents change on other screens —
 * saving one, deleting one — it re-reads whenever Home regains focus instead of
 * showing a stale list.
 */

import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner } from '@/components/atoms/banner';
import { Card, ListRow } from '@/components/atoms/card';
import { AppIcon } from '@/components/atoms/icon';
import { ToolGrid } from '@/components/molecules/tool-grid';
import { BottomTabInset, MaxContentWidth, Spacing, touchTarget } from '@/constants/theme';
import { HOME_TOOLS } from '@/constants/tools';
import { listDocuments } from '@/data/documents';
import { useAsyncData } from '@/data/use-async';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/store';

/**
 * Diameter of the floating scan button. Also drives the list's bottom padding,
 * so the last row is never hidden underneath it.
 */
const FAB_SIZE = 72;

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { state } = useStore();
  const [query, setQuery] = useState('');

  const load = useCallback(() => listDocuments(db), [db]);
  const { status, data, error, reload } = useAsyncData(load);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const stored = data ?? [];
  const documents = state.failures.emptyLibrary ? [] : stored;

  // Search covers recognised text as well as the title: finding a document by
  // something written inside it is the main reason to read the text at all.
  const normalized = query.trim().toLowerCase();
  const results = normalized
    ? documents.filter(
        (document) =>
          document.title.toLowerCase().includes(normalized) ||
          document.ocrText.toLowerCase().includes(normalized),
      )
    : documents;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: BottomTabInset + FAB_SIZE + Spacing.five },
        ]}
        keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
          Dastavez
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {documents.length === 0
            ? 'Nothing stored on this device yet.'
            : `${documents.length} ${documents.length === 1 ? 'document' : 'documents'} on this device.`}
        </Text>

        <View
          accessibilityRole="search"
          style={[styles.search, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <AppIcon name="search" size={18} color={theme.textSecondary} />
          <TextInput
            accessibilityLabel="Search documents"
            placeholder="Search documents and their text"
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <ToolGrid tools={HOME_TOOLS} />

        <View style={styles.sectionHeader}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.text }]}>
            {normalized ? 'Results' : 'Recent'}
          </Text>
          {documents.length > 0 ? (
            <Text style={[styles.sectionMeta, { color: theme.textSecondary }]}>
              {normalized ? `${results.length} of ${documents.length}` : `${documents.length} items`}
            </Text>
          ) : null}
        </View>

        {status === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : status === 'error' ? (
          <Banner
            tone="danger"
            title="Could not read your documents"
            message={error.message}
            action={{ label: 'Try again', onPress: reload }}
          />
        ) : documents.length === 0 ? (
          <Card>
            <View style={styles.empty}>
              <AppIcon name="document" size={28} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No documents yet</Text>
              <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                Import photos from this device to create your first document. Everything stays on this
                device.
              </Text>
            </View>
          </Card>
        ) : results.length === 0 ? (
          <Card>
            <View style={styles.empty}>
              <AppIcon name="search" size={28} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No matches</Text>
              <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                Nothing matches “{query.trim()}”. Clear the search to see everything.
              </Text>
            </View>
          </Card>
        ) : (
          <View style={styles.list}>
            {results.map((document) => (
              <ListRow
                key={document.id}
                title={document.title}
                subtitle={`${document.pages.length} ${document.pages.length === 1 ? 'page' : 'pages'} · ${document.fileType.toUpperCase()}`}
                icon={document.fileType === 'pdf' ? 'document' : 'image'}
                trailing={formatDate(document.date)}
                onPress={() =>
                  router.push({ pathname: '/document/[id]/view', params: { id: document.id } })
                }
              />
            ))}
          </View>
        )}

        {state.failures.emptyLibrary ? (
          <Text style={[styles.devNote, { color: theme.textSecondary }]}>
            Empty library is forced on from Settings. Turn it off to see stored documents.
          </Text>
        ) : null}
      </ScrollView>

      {/*
        The one primary action floats above the list rather than sitting inline,
        so the documents get the screen and the call to action is always
        reachable without scrolling. Import lives on the capture screen next to
        the shutter, because that is where someone decides to scan or import.
      */}
      <View
        pointerEvents="box-none"
        style={[styles.fabBar, { bottom: insets.bottom + BottomTabInset + Spacing.three }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan document"
          onPress={() => router.push('/scan/capture-preview')}
          style={({ pressed }) => [
            styles.fab,
            {
              borderColor: theme.accent,
              backgroundColor: theme.background,
              opacity: pressed ? 0.8 : 1,
            },
          ]}>
          <View style={[styles.fabInner, { backgroundColor: theme.accent }]}>
            <AppIcon name="camera" size={26} color={theme.accentText} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

/** Dates are stored as ISO strings; show a short, unambiguous form. */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  title: { fontSize: 30, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: -Spacing.two },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: touchTarget.min,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: Spacing.two },
  fabBar: {
    position: 'absolute',
    right: Spacing.three,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    // Lifts the button off the list content behind it.
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabInner: {
    width: FAB_SIZE - 16,
    height: FAB_SIZE - 16,
    borderRadius: (FAB_SIZE - 16) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  sectionTitle: { fontSize: 19, fontWeight: '700' },
  sectionMeta: { fontSize: 13 },
  list: { gap: Spacing.two },
  centered: { paddingVertical: Spacing.five, alignItems: 'center' },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  devNote: { fontSize: 12, fontStyle: 'italic', marginTop: Spacing.two },
});
