import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from './button';

import { MaxContentWidth, Radius, Spacing, touchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  /** Label for the affirmative action. */
  confirmLabel: string;
  cancelLabel?: string;
  /** Renders the confirm action in the destructive colour. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmation sheet used before any destructive or irreversible-feeling step:
 * discarding a draft, deleting a document, deleting all sample documents.
 *
 * Implemented in-app rather than with `Alert` so the layout, type scale, and
 * theme match the rest of the app on both platforms.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onCancel}
        style={styles.backdrop}>
        <Pressable
          // Stop taps inside the sheet from dismissing it.
          onPress={() => {}}
          style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
          <View style={styles.actions}>
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} style={styles.action} />
            <Button
              label={confirmLabel}
              variant={destructive ? 'destructive' : 'primary'}
              onPress={onConfirm}
              style={styles.action}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  title: { fontSize: 18, fontWeight: '700' },
  message: { fontSize: 15, lineHeight: 21, marginBottom: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1, minHeight: touchTarget.min },
});