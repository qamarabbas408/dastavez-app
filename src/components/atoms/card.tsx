import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { AppIcon, type IconName } from './icon';

import { Radius, Spacing, touchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CardProps = {
  children: React.ReactNode;
  /** Makes the whole card tappable. Provide a label so it is announced properly. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

/** Grouped surface used for list rows, panels, and mock previews. */
export function Card({ children, onPress, accessibilityLabel, style }: CardProps) {
  const theme = useTheme();
  const container: ViewStyle = {
    backgroundColor: theme.backgroundElement,
    borderColor: theme.border,
  };

  if (!onPress) {
    return <View style={[styles.card, container, style]}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.tappable, container, { opacity: pressed ? 0.7 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

export type ListRowProps = {
  title: string;
  subtitle: string;
  icon?: IconName;
  /** Right-aligned metadata such as a date or page count. */
  trailing?: string;
  onPress?: () => void;
};

export function ListRow({ title, subtitle, icon, trailing, onPress }: ListRowProps) {
  const theme = useTheme();

  return (
    <Card onPress={onPress} accessibilityLabel={`${title}. ${subtitle}`}>
      <View style={styles.row}>
        {icon ? <AppIcon name={icon} size={22} color={theme.accent} /> : null}
        <View style={styles.rowText}>
          <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.text }]}>
            {title}
          </Text>
          <Text numberOfLines={1} style={[styles.rowSubtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </Text>
        </View>
        {trailing ? (
          <Text style={[styles.trailing, { color: theme.textSecondary }]}>{trailing}</Text>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  tappable: { minHeight: touchTarget.min },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowText: { flex: 1, gap: Spacing.half },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSubtitle: { fontSize: 14 },
  trailing: { fontSize: 13 },
});