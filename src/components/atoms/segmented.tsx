import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from './icon';

import { Radius, Spacing, touchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: React.ComponentProps<typeof AppIcon>['name'];
};

export type SegmentedProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

/**
 * Segmented control used for the Preview / Text switch in Document View.
 * Each option is a button with its own label so the group reads correctly to a
 * screen reader rather than announcing a single composite control.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedProps<T>) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.container, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              selected && { backgroundColor: theme.accent },
              pressed && { opacity: 0.75 },
            ]}>
            {option.icon ? (
              <AppIcon
                name={option.icon}
                size={16}
                color={selected ? theme.accentText : theme.textSecondary}
              />
            ) : null}
            <Text
              style={[
                styles.label,
                { color: selected ? theme.accentText : theme.text },
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.one,
    gap: Spacing.one,
  },
  option: {
    flex: 1,
    minHeight: touchTarget.min - 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  label: { fontSize: 15, fontWeight: '600' },
});