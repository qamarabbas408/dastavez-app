/**
 * Stand-in for a page image.
 *
 * The prototype has no real captures or files, so this draws a labelled sheet
 * rather than showing a photo. It is deliberately obviously a mock: a reviewer
 * should never mistake it for real scanned content, and there is no invented
 * document imagery anywhere in this app.
 *
 * The applied filter and rotation are reflected so Edit & Save and Page Review
 * have visible consequences.
 */

import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { MockPage } from '@/store/types';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const FILTER_LABEL: Record<MockPage['filter'], string> = {
  original: 'Original',
  greyscale: 'Greyscale',
  highContrast: 'High contrast',
};

/** Approximate paper proportion, so previews read as pages rather than tiles. */
const PAPER_RATIO = 1.294;

export type PagePreviewProps = {
  page: MockPage;
  /** Visual width; height follows the paper proportion. */
  width?: number;
  /** Smaller variant used in page-review thumbnails. */
  compact?: boolean;
  style?: ViewStyle;
};

export function PagePreview({ page, width = 220, compact = false, style }: PagePreviewProps) {
  const theme = useTheme();
  const height = Math.round(width * PAPER_RATIO);

  return (
    <View
      accessible
      // Announced as a mock page so screen reader users are not told it is a photo.
      accessibilityLabel={`Mock page ${page.order + 1}, ${FILTER_LABEL[page.filter]}`}
      style={[
        styles.paper,
        {
          width,
          height,
          backgroundColor: filterBackground(page.filter, theme.backgroundElement, theme.text),
          borderColor: theme.border,
          transform: [{ rotate: `${page.rotation}deg` }],
        },
        style,
      ]}>
      <View style={styles.glyphArea}>
        <View style={[styles.glyph, { backgroundColor: glyphColor(page.filter, theme.textSecondary) }]} />
        <View style={[styles.line, styles.lineLong, { backgroundColor: glyphColor(page.filter, theme.textSecondary) }]} />
        <View style={[styles.line, styles.lineShort, { backgroundColor: glyphColor(page.filter, theme.textSecondary) }]} />
      </View>
      {!compact ? (
        <Text style={[styles.caption, { color: theme.textSecondary }]}>{FILTER_LABEL[page.filter]}</Text>
      ) : null}
    </View>
  );
}

function filterBackground(filter: MockPage['filter'], base: string, text: string): string {
  if (filter === 'greyscale') return '#E9EAEC';
  if (filter === 'highContrast') return text;
  return base;
}

/** In the high-contrast treatment the paper is dark, so the marks flip light. */
function glyphColor(filter: MockPage['filter'], textSecondary: string): string {
  return filter === 'highContrast' ? '#F2F5F8' : textSecondary;
}

const styles = StyleSheet.create({
  paper: {
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
    gap: Spacing.two,
  },
  glyphArea: { alignItems: 'center', gap: Spacing.one, width: '70%' },
  glyph: { height: 10, width: '55%', borderRadius: 2, opacity: 0.5 },
  line: { height: 4, borderRadius: 2, opacity: 0.35 },
  lineLong: { width: '100%' },
  lineShort: { width: '65%' },
  caption: { fontSize: 11, fontWeight: '600' },
});
