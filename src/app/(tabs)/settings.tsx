/**
 * Settings: privacy posture, app lock, data management, and the developer panel.
 *
 * The developer panel is the reason this screen exists for a reviewer: it forces
 * every empty, cancelled, and failed state in the flow without needing a broken
 * device or a revoked permission. It is gated on `__DEV__` and has no effect on
 * a release build.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner } from '@/components/atoms/banner';
import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { ConfirmDialog } from '@/components/atoms/confirm-dialog';
import { AppIcon } from '@/components/atoms/icon';
import { BottomTabInset, MaxContentWidth, Spacing, touchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/store';
import type { FailureFlags } from '@/store/types';

const FAILURE_LABELS: Record<keyof FailureFlags, { title: string; detail: string }> = {
  emptyLibrary: {
    title: 'Empty library',
    detail: 'Home shows no documents even though sample files exist.',
  },
  permissionDenied: {
    title: 'Camera permission denied',
    detail: 'Scan shows the permission explanation instead of a viewfinder.',
  },
  unlockCancelled: {
    title: 'Unlock cancelled',
    detail: 'The unlock attempt is dismissed instead of succeeding.',
  },
  ocrFailure: {
    title: 'OCR failure',
    detail: 'Text recognition ends in an error with retry and skip.',
  },
  lowStorage: {
    title: 'Low storage',
    detail: 'Saving and exporting warn that there is not enough room.',
  },
  exportCancelled: {
    title: 'Export cancelled',
    detail: 'The share sheet is dismissed and the status line explains why.',
  },
};

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { state, dispatch, visibleDocuments } = useStore();
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const dev = __DEV__;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: BottomTabInset + Spacing.four },
        ]}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
          Settings
        </Text>

        <Card>
          <View style={styles.row}>
            <AppIcon name="lock" size={22} color={theme.accent} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Everything stays on this device</Text>
              <Text style={[styles.rowBody, { color: theme.textSecondary }]}>
                Dastavez does not upload documents, run background jobs, or share your data. Deleting a
                document removes it for good.
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.actions}>
          <Button
            label="Lock app"
            icon="lock"
            variant="secondary"
            fullWidth
            onPress={() => {
              dispatch({ type: 'unlock/cancel', message: 'App locked.' });
              router.replace('/(onboarding)/unlock');
            }}
          />
          <Button
            label="Delete all documents"
            icon="trash"
            variant="destructive"
            fullWidth
            disabled={visibleDocuments.length === 0}
            onPress={() => setConfirmDeleteAll(true)}
          />
        </View>

        {dev ? (
          <View style={styles.devSection}>
            <Text style={[styles.devHeading, { color: theme.textSecondary }]}>Developer panel</Text>
            <Banner
              tone="info"
              title="Prototype controls"
              message="These switches exist only in development builds so every failure state can be reviewed without breaking a real device. Turning one on changes what the screens show, not any real permission."
            />
            <Card>
              {Object.entries(FAILURE_LABELS).map(([key, meta], index) => {
                const flag = key as keyof FailureFlags;
                return (
                  <View
                    key={key}
                    style={[styles.toggle, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: theme.text }]}>{meta.title}</Text>
                      <Text style={[styles.rowBody, { color: theme.textSecondary }]}>{meta.detail}</Text>
                    </View>
                    <Switch
                      value={state.failures[flag]}
                      onValueChange={() => dispatch({ type: 'failure/toggle', key: flag })}
                      accessibilityLabel={`Force: ${meta.title}`}
                      trackColor={{ true: theme.accent, false: theme.border }}
                    />
                  </View>
                );
              })}
            </Card>
            <Button
              label="Reset all developer switches"
              variant="quiet"
              onPress={() => dispatch({ type: 'failure/reset' })}
            />
          </View>
        ) : null}

        <Text style={[styles.version, { color: theme.textSecondary }]}>Dastavez prototype · v0.1.0</Text>
      </ScrollView>

      <ConfirmDialog
        visible={confirmDeleteAll}
        title="Delete all documents?"
        message={`This removes all ${visibleDocuments.length} documents from this device. This cannot be undone.`}
        confirmLabel="Delete all"
        destructive
        onConfirm={() => {
          dispatch({ type: 'library/deleteAll' });
          setConfirmDeleteAll(false);
        }}
        onCancel={() => setConfirmDeleteAll(false)}
      />
    </View>
  );
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
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  rowText: { flex: 1, gap: Spacing.one },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowBody: { fontSize: 14, lineHeight: 20 },
  actions: { gap: Spacing.two },
  devSection: { gap: Spacing.three, marginTop: Spacing.two },
  devHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: touchTarget.min,
  },
  version: { fontSize: 12, textAlign: 'center', marginTop: Spacing.two },
});
