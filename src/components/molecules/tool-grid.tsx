/**
 * The quick-tool grid, shared by Home's shortcuts and the Tools tab.
 *
 * A tile with an `href` navigates. The rest have no destination yet, so they are
 * announced as unavailable rather than looking tappable and doing nothing.
 */

import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/atoms/icon';
import { Radius, Spacing, touchTarget } from '@/constants/theme';
import type { Tool } from '@/constants/tools';
import { useTheme } from '@/hooks/use-theme';

export function ToolGrid({ tools }: { tools: Tool[] }) {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {tools.map((tool) => {
        const href = tool.href;
        return (
          <Pressable
            key={tool.label}
            accessibilityRole="button"
            accessibilityLabel={tool.label}
            accessibilityHint={href ? undefined : 'Not available yet'}
            onPress={href ? () => router.navigate(href) : undefined}
            style={({ pressed }) => [styles.tool, pressed && { opacity: 0.6 }]}>
            <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
              <AppIcon name={tool.icon} size={22} color={theme.accent} />
            </View>
            <Text style={[styles.label, { color: theme.text }]} numberOfLines={2}>
              {tool.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.three },
  tool: {
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
