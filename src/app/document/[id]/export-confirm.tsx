/**
 * Export Confirmation.
 *
 * Sits between choosing a format and handing the file off, and exists mainly to
 * be honest: once a file leaves Dastavez, whatever receives it decides what
 * happens to it. Saying that here is better than implying the app stays in
 * control of the destination.
 *
 * Cancel returns to the document without changing anything.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { AppIcon } from '@/components/atoms/icon';
import { Screen } from '@/components/molecules/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/store';

export default function ExportConfirmScreen() {
  const theme = useTheme();
  const { id, format } = useLocalSearchParams<{ id?: string; format?: string }>();
  const { state } = useStore();

  const document = state.documents.find((doc) => doc.id === id);
  const asPdf = format !== 'jpeg';
  const formatLabel = asPdf ? 'PDF' : 'JPEG';

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/document/${id}/view`);
    }
  };

  return (
    <Screen
      title={`Export as ${formatLabel}`}
      subtitle={document ? document.title : 'Document'}
      onBack={goBack}>
      <Card>
        <View style={styles.summaryHeader}>
          <View style={[styles.iconWrap, { backgroundColor: theme.accentSoft }]}>
            <AppIcon name={asPdf ? 'document' : 'image'} size={22} color={theme.accent} />
          </View>
          <View style={styles.summaryText}>
            <Text style={[styles.summaryTitle, { color: theme.text }]}>{formatLabel}</Text>
            <Text style={[styles.summaryMeta, { color: theme.textSecondary }]}>
              {document
                ? `${document.pages.length} ${document.pages.length === 1 ? 'page' : 'pages'}`
                : 'Document unavailable'}
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.noticeHeader}>
          <AppIcon name="info" size={20} color={theme.accent} />
          <Text style={[styles.noticeTitle, { color: theme.text }]}>You are leaving the app</Text>
        </View>
        <Text style={[styles.noticeBody, { color: theme.textSecondary }]}>
          The next screen is a simulation. In a real app, the file would be handed to whichever app
          you pick, and from that point Dastavez has no control over it — that app decides where it is
          stored, whether it is backed up, and who else can see it.
        </Text>
        <Text style={[styles.noticeBody, { color: theme.textSecondary }]}>
          No file is written and nothing is uploaded in this prototype.
        </Text>
      </Card>

      <View style={styles.actions}>
        <Button label="Cancel" variant="secondary" fullWidth onPress={goBack} />
        <Button
          label="Continue"
          icon="share"
          variant="primary"
          fullWidth
          onPress={() =>
            router.push({ pathname: '/document/[id]/share-handoff', params: { id: document?.id ?? '', format: formatLabel } })
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  summaryText: { flex: 1, gap: 2 },
  summaryTitle: { fontSize: 17, fontWeight: '700' },
  summaryMeta: { fontSize: 14 },
  noticeHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  noticeTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  noticeBody: { fontSize: 14, lineHeight: 21, marginBottom: Spacing.two },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
});
