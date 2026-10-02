/**
 * Crop editor: the page image with draggable handles over it.
 *
 * There is a round handle on each corner and a smaller square one at the middle
 * of each edge. An edge handle moves the whole side rather than one end, which
 * is the gesture a scanner's crop screen teaches.
 *
 * The screen owns the pending crop, so this component holds no crop state and
 * Cancel is simply "stop rendering". Corners arrive and leave in **source-image
 * space**; this is the only place that knows about display space, because it is
 * the only place that knows how the page is currently turned. Converting here
 * means rotation and crop never invalidate each other.
 *
 * The quad itself is still four corners — an edge handle is derived from the
 * pair it sits between, so it adds a way to drag, not a fifth piece of state.
 *
 * Without the image's natural size there is nothing trustworthy to attach a
 * corner to, so the overlays wait for `onLoad` rather than guessing.
 */

import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type ImageStyle,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { NormalizedPoint, PageCorners } from '@/data/types';

import { FULL_FRAME } from '@/data/image-edit';
import { Radius, touchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CORNER_KEYS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const;
type CornerKey = (typeof CORNER_KEYS)[number];

const CORNER_LABEL: Record<CornerKey, string> = {
  topLeft: 'Top left',
  topRight: 'Top right',
  bottomRight: 'Bottom right',
  bottomLeft: 'Bottom left',
};

const CORNERS = new Set<string>(CORNER_KEYS);

/** An edge handle, named for the side it moves. */
const EDGE_KEYS = ['top', 'right', 'bottom', 'left'] as const;
type EdgeKey = (typeof EDGE_KEYS)[number];

const EDGE_CORNERS: Record<EdgeKey, readonly [CornerKey, CornerKey]> = {
  top: ['topLeft', 'topRight'],
  right: ['topRight', 'bottomRight'],
  bottom: ['bottomRight', 'bottomLeft'],
  left: ['bottomLeft', 'topLeft'],
};

const EDGE_LABEL: Record<EdgeKey, string> = {
  top: 'Top',
  right: 'Right',
  bottom: 'Bottom',
  left: 'Left',
};

type HandleKey = CornerKey | EdgeKey;

function isCorner(key: HandleKey): key is CornerKey {
  return CORNERS.has(key);
}

const LINE_WIDTH = 2;
const HANDLE_SIZE = 24;
/** A different shape from the corners, so the two read as different gestures. */
const EDGE_HANDLE_SIZE = 16;
/** Just enough rounding to look deliberate, still unmistakably a square. */
const EDGE_HANDLE_RADIUS = 3;
/** Half the minimum touch target, so grabbing any handle is a full-size tap. */
const GRAB_RADIUS = touchTarget.min / 2;
/** How far an accessibility action nudges a handle. */
const NUDGE = 0.02;

const A11Y_ACTIONS = [
  { name: 'moveLeft', label: 'Move left' },
  { name: 'moveRight', label: 'Move right' },
  { name: 'moveUp', label: 'Move up' },
  { name: 'moveDown', label: 'Move down' },
];

type XY = { x: number; y: number };

/**
 * Display space -> source space for the page's current rotation. `rotation` is
 * applied clockwise, so these are the matching rotations and their inverses.
 */
function toDisplay(point: NormalizedPoint, rotation: number): NormalizedPoint {
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      return { x: 1 - point.y, y: point.x };
    case 180:
      return { x: 1 - point.x, y: 1 - point.y };
    case 270:
      return { x: point.y, y: 1 - point.x };
    default:
      return point;
  }
}

function toSource(point: NormalizedPoint, rotation: number): NormalizedPoint {
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      return { x: point.y, y: 1 - point.x };
    case 180:
      return { x: 1 - point.x, y: 1 - point.y };
    case 270:
      return { x: 1 - point.y, y: point.x };
    default:
      return point;
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The point halfway along one edge of a quad. */
function midpoint(quad: PageCorners, a: CornerKey, b: CornerKey): NormalizedPoint {
  const from = quad[a];
  const to = quad[b];
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

function mapQuad(corners: PageCorners, point: (p: NormalizedPoint) => NormalizedPoint): PageCorners {
  return {
    topLeft: point(corners.topLeft),
    topRight: point(corners.topRight),
    bottomRight: point(corners.bottomRight),
    bottomLeft: point(corners.bottomLeft),
  };
}

type Box = { width: number; height: number };

/**
 * Where the image sits in the container.
 *
 * `visual` is the rect the rotated image actually occupies; `image` is the
 * unrotated box it is laid out in, which is then turned about its centre.
 * Fitting has to use the rotated proportions, or a page turned on its side
 * renders far too small inside a portrait viewport.
 */
function computeLayout(size: Box, box: Box, rotation: number) {
  const portrait = (((rotation % 360) + 360) % 180) === 0;
  const displayWidth = portrait ? size.width : size.height;
  const displayHeight = portrait ? size.height : size.width;
  const scale = Math.min(box.width / displayWidth, box.height / displayHeight);

  const visualWidth = displayWidth * scale;
  const visualHeight = displayHeight * scale;
  const imageWidth = portrait ? visualWidth : visualHeight;
  const imageHeight = portrait ? visualHeight : visualWidth;

  return {
    visual: {
      left: (box.width - visualWidth) / 2,
      top: (box.height - visualHeight) / 2,
      width: visualWidth,
      height: visualHeight,
    },
    image: {
      left: (box.width - imageWidth) / 2,
      top: (box.height - imageHeight) / 2,
      width: imageWidth,
      height: imageHeight,
    },
  };
}

/** One edge of the crop outline, drawn as a rotated bar between two points. */
function Edge({ from, to, color }: { from: XY; to: XY; color: string }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return (
    <View
      pointerEvents="none"
      style={[
        styles.line,
        {
          left: (from.x + to.x) / 2 - length / 2,
          top: (from.y + to.y) / 2 - LINE_WIDTH / 2,
          width: length,
          height: LINE_WIDTH,
          backgroundColor: color,
          transform: [{ rotate: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg` }],
        },
      ]}
    />
  );
}

export type CropEditorProps = {
  /** Source image URI, before any crop. */
  uri: string;
  /** Current display rotation. */
  rotation: number;
  /** Pending crop in source space. Absent means the whole image. */
  corners?: PageCorners;
  onChange: (corners: PageCorners) => void;
  style?: StyleProp<ViewStyle>;
};

export function CropEditor({ uri, rotation, corners, onChange, style }: CropEditorProps) {
  const theme = useTheme();
  const [size, setSize] = useState<Box | null>(null);
  const [box, setBox] = useState<Box | null>(null);

  const base = corners ?? FULL_FRAME;
  const display = useMemo(
    () => mapQuad(base, (point) => toDisplay(point, rotation)),
    [base, rotation],
  );

  // Where the image sits, once both the source and the container are known.
  const rect: BoxLayout | null = size && box ? computeLayout(size, box, rotation) : null;

  // Only the gesture itself has to outlive a render. Everything else is read
  // from the responder handlers' own closure, which is refreshed every render,
  // so a drag always works against the corners, rotation and layout it sees.
  const dragging = useRef<HandleKey | null>(null);
  /** The whole quad as it stood when the drag began, in display space. */
  const origin = useRef<PageCorners>(FULL_FRAME);
  const grab = useRef<XY>({ x: 0, y: 0 });

  /** The handle under a touch, when one is within the grab radius. */
  const nearest = (x: number, y: number): HandleKey | null => {
    if (!rect) return null;

    const distanceTo = (point: NormalizedPoint) => {
      const dx = rect.visual.left + point.x * rect.visual.width - x;
      const dy = rect.visual.top + point.y * rect.visual.height - y;
      return Math.hypot(dx, dy);
    };

    // Corners are listed first so they win a tie against an edge handle on a
    // quad that has been collapsed almost to a line.
    const candidates: [HandleKey, NormalizedPoint][] = [
      ...CORNER_KEYS.map((key) => [key, display[key]] as [HandleKey, NormalizedPoint]),
      ...EDGE_KEYS.map(
        (key) => [key, midpoint(display, ...EDGE_CORNERS[key])] as [HandleKey, NormalizedPoint],
      ),
    ];

    let best: HandleKey | null = null;
    let bestDistance = GRAB_RADIUS;
    for (const [key, point] of candidates) {
      const distance = distanceTo(point);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = key;
      }
    }
    return best;
  };

  const release = () => {
    dragging.current = null;
  };

  const toXY = (point: NormalizedPoint): XY =>
    rect
      ? {
          x: rect.visual.left + point.x * rect.visual.width,
          y: rect.visual.top + point.y * rect.visual.height,
        }
      : { x: 0, y: 0 };

  const points = CORNER_KEYS.map((key) => toXY(display[key]));
  const bounds = rect
    ? {
        left: Math.min(...points.map((point) => point.x)),
        right: Math.max(...points.map((point) => point.x)),
        top: Math.min(...points.map((point) => point.y)),
        bottom: Math.max(...points.map((point) => point.y)),
      }
    : null;

  const nudge = (key: CornerKey, dx: number, dy: number) => {
    const current = display[key];
    onChange({
      ...base,
      [key]: toSource({ x: clamp01(current.x + dx), y: clamp01(current.y + dy) }, rotation),
    });
  };

  /**
   * Translate one edge so the whole side follows the finger.
   *
   * Both corners take the same delta and it is clamped against the pair, so a
   * corner reaching the image border stops the edge rather than bending it out
   * of shape. `from` is the display-space quad the delta is measured against —
   * the snapshot taken when a drag began, or the live quad for a nudge.
   */
  const moveEdge = (edge: EdgeKey, dx: number, dy: number, from: PageCorners) => {
    const [a, b] = EDGE_CORNERS[edge];
    const startA = from[a];
    const startB = from[b];
    const shift = {
      x: clamp(dx, -Math.min(startA.x, startB.x), 1 - Math.max(startA.x, startB.x)),
      y: clamp(dy, -Math.min(startA.y, startB.y), 1 - Math.max(startA.y, startB.y)),
    };
    onChange({
      ...base,
      [a]: toSource({ x: startA.x + shift.x, y: startA.y + shift.y }, rotation),
      [b]: toSource({ x: startB.x + shift.x, y: startB.y + shift.y }, rotation),
    });
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const next = {
      width: event.nativeEvent.layout.width,
      height: event.nativeEvent.layout.height,
    };
    setBox((current) =>
      current && current.width === next.width && current.height === next.height ? current : next,
    );
  };

  // Nothing inside the root may take the hit, so the root is always the touch
  // target and `locationX` is always relative to it. Children are drawn only.
  const imageStyle: ImageStyle = rect
    ? {
        position: 'absolute',
        left: rect.image.left,
        top: rect.image.top,
        width: rect.image.width,
        height: rect.image.height,
        transform: [{ rotate: `${rotation}deg` }],
      }
    : { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 };

  return (
    <View
      style={[styles.root, style]}
      onLayout={onLayout}
      // The image only takes the gesture when a handle is under the touch, so
      // the rest of the crop surface stays inert rather than catching drags.
      onStartShouldSetResponder={(event) =>
        nearest(event.nativeEvent.locationX, event.nativeEvent.locationY) !== null
      }
      onMoveShouldSetResponder={() => dragging.current !== null}
      onResponderGrant={(event) => {
        const key = nearest(event.nativeEvent.locationX, event.nativeEvent.locationY);
        if (!key || !rect) return;
        dragging.current = key;
        origin.current = display;
        grab.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
      }}
      onResponderMove={(event) => {
        const key = dragging.current;
        if (!key || !rect || rect.visual.width === 0 || rect.visual.height === 0) return;

        const dx = (event.nativeEvent.pageX - grab.current.x) / rect.visual.width;
        const dy = (event.nativeEvent.pageY - grab.current.y) / rect.visual.height;

        if (isCorner(key)) {
          const start = origin.current[key];
          onChange({
            ...base,
            [key]: toSource({ x: clamp01(start.x + dx), y: clamp01(start.y + dy) }, rotation),
          });
          return;
        }

        moveEdge(key, dx, dy, origin.current);
      }}
      onResponderRelease={release}
      onResponderTerminate={release}>
      <Image
        source={{ uri }}
        contentFit="contain"
        pointerEvents="none"
        style={imageStyle}
        onLoad={(event) => {
          const next = { width: event.source.width, height: event.source.height };
          setSize((current) =>
            current && current.width === next.width && current.height === next.height
              ? current
              : next,
          );
        }}
      />

      {rect && bounds ? (
        <>
          {/* Everything outside the crop reads as dimmed, so the kept area is obvious. */}
          <View
            pointerEvents="none"
            style={[styles.dim, { left: 0, top: 0, right: 0, height: bounds.top }]}
          />
          <View
            pointerEvents="none"
            style={[styles.dim, { left: 0, top: bounds.bottom, right: 0, bottom: 0 }]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.dim,
              { left: 0, top: bounds.top, width: bounds.left, height: bounds.bottom - bounds.top },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.dim,
              { left: bounds.right, top: bounds.top, right: 0, height: bounds.bottom - bounds.top },
            ]}
          />

          <Edge from={points[0]} to={points[1]} color={theme.accent} />
          <Edge from={points[1]} to={points[2]} color={theme.accent} />
          <Edge from={points[2]} to={points[3]} color={theme.accent} />
          <Edge from={points[3]} to={points[0]} color={theme.accent} />

          {CORNER_KEYS.map((key, index) => (
            <View
              key={key}
              pointerEvents="none"
              accessible
              accessibilityLabel={`${CORNER_LABEL[key]} crop corner`}
              accessibilityHint="Drag to adjust, or use the move actions."
              accessibilityActions={A11Y_ACTIONS}
              onAccessibilityAction={(event) => {
                const action = event.nativeEvent.actionName;
                if (action === 'moveLeft') nudge(key, -NUDGE, 0);
                else if (action === 'moveRight') nudge(key, NUDGE, 0);
                else if (action === 'moveUp') nudge(key, 0, -NUDGE);
                else if (action === 'moveDown') nudge(key, 0, NUDGE);
              }}
              style={[
                styles.handle,
                {
                  left: points[index].x - HANDLE_SIZE / 2,
                  top: points[index].y - HANDLE_SIZE / 2,
                  borderColor: theme.background,
                  backgroundColor: theme.accent,
                },
              ]}
            />
          ))}

          {EDGE_KEYS.map((key) => {
            const point = toXY(midpoint(display, ...EDGE_CORNERS[key]));
            return (
              <View
                key={key}
                pointerEvents="none"
                accessible
                accessibilityLabel={`${EDGE_LABEL[key]} crop edge`}
                accessibilityHint="Drag to move the whole edge, or use the move actions."
                accessibilityActions={A11Y_ACTIONS}
                onAccessibilityAction={(event) => {
                  const action = event.nativeEvent.actionName;
                  if (action === 'moveLeft') moveEdge(key, -NUDGE, 0, display);
                  else if (action === 'moveRight') moveEdge(key, NUDGE, 0, display);
                  else if (action === 'moveUp') moveEdge(key, 0, -NUDGE, display);
                  else if (action === 'moveDown') moveEdge(key, 0, NUDGE, display);
                }}
                style={[
                  styles.edgeHandle,
                  {
                    left: point.x - EDGE_HANDLE_SIZE / 2,
                    top: point.y - EDGE_HANDLE_SIZE / 2,
                    borderColor: theme.background,
                    backgroundColor: theme.accent,
                  },
                ]}
              />
            );
          })}
        </>
      ) : null}
    </View>
  );
}

type BoxLayout = ReturnType<typeof computeLayout>;

const styles = StyleSheet.create({
  // Not clipped: a corner sits on the image edge, and its handle straddles it.
  root: { flex: 1 },
  dim: { position: 'absolute', backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  line: { position: 'absolute' },
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: Radius.pill,
    borderWidth: 3,
  },
  // A rounded square rather than a circle, so a corner and an edge handle are
  // never mistaken for each other on a small screen.
  edgeHandle: {
    position: 'absolute',
    width: EDGE_HANDLE_SIZE,
    height: EDGE_HANDLE_SIZE,
    borderRadius: EDGE_HANDLE_RADIUS,
    borderWidth: 3,
  },
});
