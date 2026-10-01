/**
 * Home: recent documents, search, and the two ways in (Scan, Import).
 *
 * This is a tab root, so it has no back affordance and sits above the native tab
 * bar. The tab bar already reserves its own space, so content only pads for the
 * bottom safe area, not for a tab bar height.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/atoms/button';
import { Card, ListRow } from '@/components/atoms/card';
import { AppIcon } from '@/components/atoms/icon';
import { BottomTabInset, MaxContentWidth, Spacing, touchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/store';

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { visibleDocuments, state } = useStore();
  const [query, setQuery] = useState('');

  const normalized = query.trim().toLowerCase();
  const documents = normalized
    ? visibleDocuments.filter((document) => document.title.toLowerCase().includes(normalized))
    : visibleDocuments;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: BottomTabInset + Spacing.four },
        ]}
        keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
          Dastavez
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {visibleDocuments.length === 0
            ? 'Nothing stored on this device yet.'
            : `${visibleDocuments.length} sample ${visibleDocuments.length === 1 ? 'document' : 'documents'} on this device.`}
        </Text>

        <View
          accessibilityRole="search"
          style={[styles.search, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <AppIcon name="search" size={18} color={theme.textSecondary} />
          <TextInput
            accessibilityLabel="Search documents"
            placeholder="Search documents"
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <View style={styles.actions}>
          <Button
            label="Scan document"
            icon="camera"
            variant="primary"
            fullWidth
            onPress={() => router.push('/scan/capture-preview')}
          />
          <Button
            label="Import file"
            icon="folder"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/import/source')}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.text }]}>
            {normalized ? 'Results' : 'Recent'}
          </Text>
          {visibleDocuments.length > 0 ? (
            <Text style={[styles.sectionMeta, { color: theme.textSecondary }]}>
              {normalized ? `${documents.length} of ${visibleDocuments.length}` : `${visibleDocuments.length} items`}
            </Text>
          ) : null}
        </View>

        {visibleDocuments.length === 0 ? (
          <Card>
            <View style={styles.empty}>
              <AppIcon name="document" size={28} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No documents yet</Text>
              <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                Scan a page or import a file to see it listed here. Everything stays on this device.
              </Text>
            </View>
          </Card>
        ) : documents.length === 0 ? (
          <Card>
            <View style={styles.empty}>
              <AppIcon name="search" size={28} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No matches</Text>
              <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                Nothing is titled “{query.trim()}”. Clear the search to see everything.
              </Text>
            </View>
          </Card>
        ) : (
          <View style={styles.list}>
            {documents.map((document) => (
              <ListRow
                key={document.id}
                title={document.title}
                subtitle={`${document.pages.length} ${document.pages.length === 1 ? 'page' : 'pages'} · ${document.fileType.toUpperCase()}`}
                icon={document.fileType === 'pdf' ? 'document' : 'image'}
                trailing={formatDate(document.date)}
                onPress={() => router.push(`/document/${document.id}/view`)}
              />
            ))}
          </View>
        )}

        {state.failures.emptyLibrary ? (
          <Text style={[styles.devNote, { color: theme.textSecondary }]}>
            Empty library is forced on from Settings. Turn it off to see the sample documents.
          </Text>
        ) : null}
      </ScrollView>
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
  actions: { gap: Spacing.two },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  sectionTitle: { fontSize: 19, fontWeight: '700' },
  sectionMeta: { fontSize: 13 },
  list: { gap: Spacing.two },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  devNote: { fontSize: 12, fontStyle: 'italic', marginTop: Spacing.two },
});
