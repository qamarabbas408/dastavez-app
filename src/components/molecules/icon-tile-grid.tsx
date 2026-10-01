/**
 * A grid of tappable icon tiles, four to a row.
 *
 * Shared by the tool shortcuts and the document action row so both read as the
 * same control. A tile with no handler is announced as unavailable rather than
 * looking tappable and doing nothing.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, type IconName } from '@/components/atoms/icon';
import { Radius, Spacing, touchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconTile = {
  icon: IconName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Renders the tile in the danger colour, for destructive actions. */
  destructive?: boolean;
  /** Marks the tile as the active choice, e.g. the open editing tool. */
  selected?: boolean;
};

export function IconTileGrid({ tiles }: { tiles: IconTile[] }) {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {tiles.map((tile) => {
        const foreground = tile.destructive
          ? theme.danger
          : tile.selected
            ? theme.accentText
            : theme.accent;
        const background = tile.destructive
          ? theme.dangerSoft
          : tile.selected
            ? theme.accent
            : theme.accentSoft;
        const label = tile.destructive ? theme.danger : tile.selected ? theme.accent : theme.text;

        return (
          <Pressable
            key={tile.label}
            accessibilityRole="button"
            accessibilityLabel={tile.label}
            accessibilityState={{ disabled: !!tile.disabled, selected: !!tile.selected }}
            accessibilityHint={tile.onPress ? undefined : 'Not available yet'}
            disabled={tile.disabled}
            onPress={tile.onPress}
            style={({ pressed }) => [
              styles.tile,
              pressed && { opacity: 0.6 },
              tile.disabled && { opacity: 0.45 },
            ]}>
            <View style={[styles.icon, { backgroundColor: background }]}>
              <AppIcon name={tile.icon} size={22} color={foreground} />
            </View>
            <Text style={[styles.label, { color: label }]} numberOfLines={2}>
              {tile.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.three },
  tile: {
    width: '25%',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    minHeight: touchTarget.min,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: Radius.large,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 16 },
});
