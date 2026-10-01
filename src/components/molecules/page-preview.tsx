/**
 * Page preview: a real image when one exists, a drawn stand-in when it does not.
 *
 * When a page has a `uri` — imported photos today, real captures later — the
 * actual image is rendered from app storage. Otherwise a labelled sheet is
 * drawn, and it is deliberately obviously a mock: a reviewer should never
 * mistake it for scanned content.
 *
 * Filters are baked with the same function that saving uses, so the preview
 * shows the real result rather than an approximation. Rotation stays a display
 * transform here; it is baked on save.
 *
 * The prop type is structural so both a draft page and a saved page from the
 * database can be passed without conversion.
 */

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { PageFilter } from '@/data/types';
import { bakeImage } from '@/data/image-edit';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const FILTER_LABEL: Record<PageFilter, string> = {
  original: 'Original',
  greyscale: 'Greyscale',
  highContrast: 'High contrast',
};

/** Approximate paper proportion, so drawn previews read as pages not tiles. */
const PAPER_RATIO = 1.294;

/** The fields this component needs. Satisfied by both `DraftPage` and `Page`. */
export type PreviewPage = {
  order: number;
  rotation: number;
  filter: PageFilter;
  uri?: string;
};

export type PagePreviewProps = {
  page: PreviewPage;
  /** Visual width; height follows the paper proportion. */
  width?: number;
  /** Smaller variant used in page-review thumbnails. */
  compact?: boolean;
  /**
   * Sizes the preview to the space it is given instead of to `width`. The
   * frame keeps the paper proportion and is sized so it still fits once the
   * page is rotated.
   */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
};

type Box = { width: number; height: number };

/**
 * Largest paper width that fits `box`. Rotation is a transform, so it does not
 * change the layout size — but the drawn result swaps axes, so a page turned
 * on its side has to be fitted against the swapped bounds or it overflows.
 */
function fitWidth(box: Box, rotation: number): number {
  const portrait = rotation % 180 === 0;
  const maxW = portrait ? box.width : box.height;
  const maxH = portrait ? box.height : box.width;
  return Math.max(0, Math.floor(Math.min(maxW, maxH / PAPER_RATIO)));
}

/**
 * The image to display, with the chosen filter baked in.
 *
 * Skia work happens off the render path, so the unfiltered image stays on screen
 * until the filtered one is ready rather than flashing empty.
 */
function useFilteredUri(uri: string | undefined, filter: PageFilter): string | undefined {
  const [filtered, setFiltered] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!uri || filter === 'original') return;

    let cancelled = false;
    bakeImage(uri, 0, filter)
      .then((result) => {
        if (!cancelled) setFiltered(result);
      })
      .catch((error: unknown) => {
        if (__DEV__) console.warn('Filter preview failed', error);
      });

    return () => {
      cancelled = true;
    };
  }, [uri, filter]);

  return filter === 'original' ? uri : (filtered ?? uri);
}

export function PagePreview({
  page,
  width = 220,
  compact = false,
  fill = false,
  style,
}: PagePreviewProps) {
  const theme = useTheme();
  const source = useFilteredUri(page.uri, page.filter);
  const [box, setBox] = useState<Box | null>(null);

  const w = fill ? (box ? fitWidth(box, page.rotation) : 0) : width;
  const height = Math.round(w * PAPER_RATIO);
  const rotation = { transform: [{ rotate: `${page.rotation}deg` }] };
  const frame = { width: w, height, borderRadius: Radius.small, borderColor: theme.border };

  const content = source ? (
    <View
      accessible
      accessibilityLabel={`Page ${page.order + 1}`}
      style={[styles.frame, frame, { backgroundColor: theme.backgroundElement }, rotation, style]}>
      <Image
        source={{ uri: source }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        accessibilityLabel={`Page ${page.order + 1}`}
      />
    </View>
  ) : (
    <View
      accessible
      accessibilityLabel={`Mock page ${page.order + 1}, ${FILTER_LABEL[page.filter]}`}
      style={[
        styles.paper,
        frame,
        { backgroundColor: filterBackground(page.filter, theme.backgroundElement, theme.text) },
        rotation,
        style,
      ]}>
      <View style={styles.glyphArea}>
        <View style={[styles.glyph, { backgroundColor: glyphColor(page.filter, theme.textSecondary) }]} />
        <View
          style={[
            styles.line,
            styles.lineLong,
            { backgroundColor: glyphColor(page.filter, theme.textSecondary) },
          ]}
        />
        <View
          style={[
            styles.line,
            styles.lineShort,
            { backgroundColor: glyphColor(page.filter, theme.textSecondary) },
          ]}
        />
      </View>
      {!compact ? (
        <Text style={[styles.caption, { color: theme.textSecondary }]}>{FILTER_LABEL[page.filter]}</Text>
      ) : null}
    </View>
  );

  if (!fill) return content;

  return (
    <View
      style={styles.fill}
      onLayout={(event) => {
        const next = {
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        };
        // Same box would only trigger a re-render, not a new layout, but
        // bailing out keeps the first paint stable.
        setBox((current) =>
          current && current.width === next.width && current.height === next.height ? current : next,
        );
      }}>
      {box ? content : null}
    </View>
  );
}

function filterBackground(filter: PageFilter, base: string, text: string): string {
  if (filter === 'greyscale') return '#E9EAEC';
  if (filter === 'highContrast') return text;
  return base;
}

/** In the high-contrast treatment the paper is dark, so the marks flip light. */
function glyphColor(filter: PageFilter, textSecondary: string): string {
  return filter === 'highContrast' ? '#F2F5F8' : textSecondary;
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  frame: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  paper: {
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
