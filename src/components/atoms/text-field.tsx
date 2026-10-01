import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { AppIcon } from './icon';

import { Radius, Spacing, touchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextFieldProps = TextInputProps & {
  label: string;
  /** Hint rendered under the field. */
  helpText?: string;
  /** Validation message. Rendered in the danger colour and announced. */
  errorText?: string;
  icon?: 'search' | 'text';
};

export function TextField({ label, helpText, errorText, icon, style, ...rest }: TextFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: errorText ? theme.danger : theme.border,
          },
        ]}>
        {icon ? <AppIcon name={icon} size={18} color={theme.textSecondary} /> : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }, style]}
          {...rest}
        />
      </View>
      {errorText ? (
        <Text accessibilityLiveRegion="polite" style={[styles.help, { color: theme.danger }]}>
          {errorText}
        </Text>
      ) : helpText ? (
        <Text style={[styles.help, { color: theme.textSecondary }]}>{helpText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.one },
  label: { fontSize: 14, fontWeight: '600' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: touchTarget.min,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.two,
  },
  help: { fontSize: 13 },
});