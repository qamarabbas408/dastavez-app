/**
 * Unlock: a mock of the device's own authentication prompt.
 *
 * No real biometrics or passcode is used and no permission is requested — the
 * sheet below is an in-app stand-in. That is stated on screen so a reviewer does
 * not think a passcode dialog is being captured.
 *
 * The whole screen is one small state machine: `ready` shows the call to action,
 * `prompting` shows the mock sheet, and `failed` explains what happened. All
 * three are reached by taps, and Cancel deliberately keeps the user on the
 * screen rather than bouncing them out of a locked app.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { AppIcon } from '@/components/atoms/icon';
import { MaxContentWidth, Radius, Spacing, touchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/store';

type Phase = 'ready' | 'prompting' | 'failed';

export default function UnlockScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useStore();
  const [phase, setPhase] = useState<Phase>('ready');

  const fail = (message: string) => {
    dispatch({ type: 'unlock/cancel', message });
    setPhase('failed');
  };

  const confirmMockUnlock = () => {
    // The developer switch is what makes this path reviewable: a reviewer can
    // see the failed and retry states without a real failed passcode attempt.
    if (state.failures.unlockCancelled) {
      fail('Not recognised. Check the device passcode and try again.');
      return;
    }
    dispatch({ type: 'unlock/success' });
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
        ]}>
        <View style={[styles.mark, { backgroundColor: theme.accentSoft }]}>
          <AppIcon name="lock" size={36} color={theme.accent} />
        </View>

        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
          Dastavez is locked
        </Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          Unlock with your device authentication to reach your documents.
        </Text>

        {state.status ? (
          <View style={[styles.statusBox, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
            <AppIcon name="warning" size={18} color={theme.warning} />
            <Text accessibilityLiveRegion="polite" style={[styles.statusText, { color: theme.warning }]}>
              {state.status.text}
            </Text>
          </View>
        ) : null}

        {phase === 'failed' ? (
          <Button label="Try again" icon="rotate" variant="primary" fullWidth onPress={confirmMockUnlock} />
        ) : (
          <Button label="Unlock" icon="lock" variant="primary" fullWidth onPress={() => setPhase('prompting')} />
        )}

        <Card>
          <Text style={[styles.noteTitle, { color: theme.text }]}>Prototype</Text>
          <Text style={[styles.noteBody, { color: theme.textSecondary }]}>
            This is a simulated prompt. Dastavez does not use biometrics, does not ask for a passcode, and
            has no way to read your lock screen.
          </Text>
        </Card>
      </View>

      <Modal visible={phase === 'prompting'} transparent animationType="fade" onRequestClose={() => setPhase('ready')}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss mock prompt"
          onPress={() => setPhase('ready')}
          style={styles.backdrop}>
          <Pressable onPress={() => {}} style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.sheetHeader}>
              <AppIcon name="lock" size={20} color={theme.accent} />
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Dastavez</Text>
            </View>
            <Text style={[styles.sheetBody, { color: theme.textSecondary }]}>
              Mock device authentication. No real credential is collected.
            </Text>
            <View style={styles.sheetActions}>
              <Button
                label="Cancel"
                variant="secondary"
                style={styles.sheetAction}
                onPress={() => fail('Unlock cancelled. Nothing was changed.')}
              />
              <Button label="Unlock" variant="primary" style={styles.sheetAction} onPress={confirmMockUnlock} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  statusText: { flex: 1, fontSize: 14, lineHeight: 20 },
  noteTitle: { fontSize: 15, fontWeight: '700', marginBottom: Spacing.one },
  noteBody: { fontSize: 14, lineHeight: 20 },
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
    gap: Spacing.two,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  sheetBody: { fontSize: 15, lineHeight: 21, marginBottom: Spacing.two },
  sheetActions: { flexDirection: 'row', gap: Spacing.two },
  sheetAction: { flex: 1, minHeight: touchTarget.min },
});
