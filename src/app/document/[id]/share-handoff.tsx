/**
 * Mock share handoff.
 *
 * Imitates a share sheet with invented destinations. No system share sheet is
 * opened, no file is written, and nothing leaves the device.
 *
 * Selecting a destination confirms the handoff and returns to the document. The
 * `exportCancelled` developer switch turns a selection into a cancellation, so
 * the "export did not happen" path is reviewable without a reviewer having to
 * dismiss a real sheet and guess what they saw.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/atoms/button';
import { AppIcon, type IconName } from '@/components/atoms/icon';
import { Screen } from '@/components/molecules/screen';
import { Radius, Spacing, touchTarget } from '@/constants/theme';
import { getDocument } from '@/data/documents';
import { useAsyncData } from '@/data/use-async';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/store';

const DESTINATIONS: { id: string; label: string; detail: string; icon: IconName }[] = [
  { id: 'mail', label: 'Mail', detail: 'Sample destination', icon: 'share' },
  { id: 'messages', label: 'Messages', detail: 'Sample destination', icon: 'share' },
  { id: 'files', label: 'Files', detail: 'Sample destination', icon: 'folder' },
  { id: 'notes', label: 'Notes', detail: 'Sample destination', icon: 'document' },
];

export default function ShareHandoffScreen() {
  const theme = useTheme();
  const { id, format } = useLocalSearchParams<{ id?: string; format?: string }>();
  const db = useSQLiteContext();
  const { state, dispatch } = useStore();
  const [picked, setPicked] = useState<string | null>(null);

  const load = useCallback(() => (id ? getDocument(db, id) : Promise.resolve(null)), [db, id]);
  const { data: document } = useAsyncData(load);

  const formatLabel = format ?? 'PDF';

  /**
   * Built as a route object rather than a string so `typedRoutes` can check it.
   * The document id comes from a param, so it cannot be a literal href.
   */
  const returnTo = {
    pathname: '/document/[id]/view' as const,
    params: { id: document?.id ?? id ?? '' },
  };

  const complete = (destination: string) => {
    if (state.failures.exportCancelled) {
      dispatch({
        type: 'status/set',
        status: {
          tone: 'warning',
          text: `Export cancelled. Nothing was sent to ${destination}.`,
        },
      });
      router.replace(returnTo);
      return;
    }
    dispatch({
      type: 'status/set',
      status: {
        tone: 'success',
        text: `Exported as ${formatLabel}. In a real app the file would now be in ${destination}.`,
      },
    });
    router.replace(returnTo);
  };

  return (
    <Screen
      title="Share"
      subtitle={`${formatLabel} · ${document?.title ?? 'Document'}`}
      onBack={() => router.replace(returnTo)}>
      <Text style={[styles.lead, { color: theme.textSecondary }]}>
        Choose where this file would go. These are invented destinations — nothing is sent.
      </Text>

      <View style={styles.list}>
        {DESTINATIONS.map((destination) => {
          const isPicked = destination.id === picked;
          return (
            <Pressable
              key={destination.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: isPicked }}
              accessibilityLabel={`${destination.label}. ${destination.detail}`}
              onPress={() => setPicked(destination.id)}
              style={[
                styles.destination,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: isPicked ? theme.accent : theme.border,
                },
              ]}>
              <View style={[styles.iconWrap, { backgroundColor: theme.accentSoft }]}>
                <AppIcon name={destination.icon} size={20} color={theme.accent} />
              </View>
              <View style={styles.destinationText}>
                <Text style={[styles.destinationLabel, { color: theme.text }]}>
                  {destination.label}
                </Text>
                <Text style={[styles.destinationDetail, { color: theme.textSecondary }]}>
                  {destination.detail}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {state.failures.exportCancelled ? (
        <Text style={[styles.devNote, { color: theme.textSecondary }]}>
          The developer switch “Export cancelled” is on, so choosing a destination will report a
          cancellation.
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="Cancel"
          variant="secondary"
          fullWidth
          onPress={() => {
            dispatch({ type: 'status/set', status: { tone: 'info', text: 'Export cancelled.' } });
            router.replace(returnTo);
          }}
        />
        <Button
          label={picked ? 'Share here' : 'Select a destination'}
          icon="share"
          variant="primary"
          fullWidth
          disabled={!picked}
          onPress={() =>
            picked && complete(DESTINATIONS.find((d) => d.id === picked)?.label ?? 'the selected app')
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 15, lineHeight: 22 },
  list: { gap: Spacing.two },
  destination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: touchTarget.min,
    borderRadius: Radius.medium,
    borderWidth: 2,
    padding: Spacing.three,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationText: { flex: 1, gap: 2 },
  destinationLabel: { fontSize: 16, fontWeight: '600' },
  destinationDetail: { fontSize: 13 },
  devNote: { fontSize: 12, fontStyle: 'italic', lineHeight: 18 },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
});
