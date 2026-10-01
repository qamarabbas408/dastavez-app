import { Pressable, StyleSheet, Text, View, type PressableProps, type ViewStyle } from 'react-native';

import { AppIcon, type IconName } from './icon';

import { Radius, Spacing, touchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'destructive';
export type ButtonSize = 'regular' | 'compact';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Stretches to the container width. Use for primary page actions. */
  fullWidth?: boolean;
  style?: ViewStyle;
};

/**
 * The app's only button. Min height is `touchTarget.min` in both variants so
 * every control clears the platform accessibility guidance, and height is
 * allowed to grow with the user's font size rather than clipping text.
 */
export function Button({
  label,
  variant = 'secondary',
  size = 'regular',
  icon,
  fullWidth = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const theme = useTheme();

  const palette: Record<ButtonVariant, { background: string; text: string; border: string }> = {
    primary: { background: theme.accent, text: theme.accentText, border: theme.accent },
    secondary: { background: theme.backgroundElement, text: theme.text, border: theme.border },
    quiet: { background: 'transparent', text: theme.accent, border: 'transparent' },
    destructive: { background: theme.dangerSoft, text: theme.danger, border: theme.danger },
  };

  const colors = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        size === 'compact' ? styles.compact : styles.regular,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
      {...rest}>
      <View style={styles.content}>
        {icon ? <AppIcon name={icon} size={size === 'compact' ? 16 : 18} color={colors.text} /> : null}
        <Text style={[styles.label, { color: colors.text }, size === 'compact' && styles.labelCompact]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget.min,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  regular: { paddingVertical: Spacing.two },
  compact: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
  fullWidth: { alignSelf: 'stretch' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: { fontSize: 16, fontWeight: '600' },
  labelCompact: { fontSize: 14 },
});