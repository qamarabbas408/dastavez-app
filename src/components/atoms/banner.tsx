import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { AppIcon, type IconName } from './icon';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BannerTone = 'info' | 'success' | 'warning' | 'danger';

export type BannerProps = ViewProps & {
  tone: BannerTone;
  title: string;
  message?: string;
  icon?: IconName;
  /** Optional inline action, e.g. Retry or Dismiss. */
  action?: { label: string; onPress: () => void };
};

const TONE_ICON: Record<BannerTone, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'warning',
  danger: 'warning',
};

/**
 * Inline notice used for status feedback, permission explanations, and low
 * storage. Titles and messages are separate so the tone is readable at a glance
 * without relying on colour alone.
 */
export function Banner({ tone, title, message, icon, action, style }: BannerProps) {
  const theme = useTheme();

  const palette: Record<BannerTone, { background: string; text: string }> = {
    info: { background: theme.accentSoft, text: theme.accent },
    success: { background: theme.accentSoft, text: theme.success },
    warning: { background: theme.warningSoft, text: theme.warning },
    danger: { background: theme.dangerSoft, text: theme.danger },
  };

  const colors = palette[tone];

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.container, { backgroundColor: colors.background }, style]}>
      <View style={styles.header}>
        <AppIcon name={icon ?? TONE_ICON[tone]} size={18} color={colors.text} />
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
      {message ? (
        <Text style={[styles.message, { color: theme.text }]}>{message}</Text>
      ) : null}
      {action ? (
        <Text
          accessibilityRole="button"
          onPress={action.onPress}
          style={[styles.action, { color: colors.text }]}>
          {action.label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  message: { fontSize: 14, lineHeight: 20 },
  action: { fontSize: 15, fontWeight: '700' },
});