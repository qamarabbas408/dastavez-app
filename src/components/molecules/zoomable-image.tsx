/**
 * An image that can be pinched to zoom and dragged to pan.
 *
 * The gesture surface is an untransformed view, so touch coordinates — a pinch's
 * focal point included — are plain container coordinates. The transform sits on
 * an inner view, which keeps the maths the same no matter how a platform
 * reports touches on an already-scaled view.
 *
 * Zoom never drops below 1, and the offset is clamped against the contained
 * size of the image rather than the frame, so the page moves only as far as it
 * can still be seen. With the image fitting the frame there is nothing to pan,
 * which is why a preview at rest sits still under a finger.
 */

import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

const MIN_SCALE = 1;
const MAX_SCALE = 6;

type Box = { width: number; height: number };

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

/** The size `contentFit="contain"` gives `image` inside `box`. */
function containedSize(box: Box, image: Box): Box {
  'worklet';
  if (image.width <= 0 || image.height <= 0) return box;
  const fit = Math.min(box.width / image.width, box.height / image.height);
  return { width: image.width * fit, height: image.height * fit };
}

export type ZoomableImageProps = {
  uri: string;
  accessibilityLabel: string;
  /**
   * Fires on a clean tap — a pinch or a drag does not count. Used by the viewer
   * to hide its chrome, where wrapping the image in a `Pressable` would fire
   * one every time the user zooms.
   */
  onTap?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ZoomableImage({ uri, accessibilityLabel, onTap, style }: ZoomableImageProps) {
  const box = useSharedValue<Box>({ width: 0, height: 0 });
  const image = useSharedValue<Box>({ width: 0, height: 0 });

  const scale = useSharedValue(MIN_SCALE);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  /** Where the current gesture started, so updates are relative to it. */
  const originScale = useSharedValue(MIN_SCALE);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);

  const contain = () => {
    'worklet';
    const size = containedSize(box.value, image.value);
    const maxX = Math.max(0, (size.width * scale.value - box.value.width) / 2);
    const maxY = Math.max(0, (size.height * scale.value - box.value.height) / 2);
    offsetX.value = clamp(offsetX.value, -maxX, maxX);
    offsetY.value = clamp(offsetY.value, -maxY, maxY);
  };

  const remember = () => {
    'worklet';
    originScale.value = scale.value;
    originX.value = offsetX.value;
    originY.value = offsetY.value;
  };

  const reset = () => {
    scale.value = MIN_SCALE;
    offsetX.value = 0;
    offsetY.value = 0;
    originScale.value = MIN_SCALE;
    originX.value = 0;
    originY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onStart(remember)
    .onUpdate((event) => {
      const next = clamp(originScale.value * event.scale, MIN_SCALE, MAX_SCALE);
      const ratio = originScale.value > 0 ? next / originScale.value : 1;
      // Zoom about the fingers rather than the centre: shift the offset so the
      // point beneath the pinch stays beneath it.
      const focalX = event.focalX - box.value.width / 2;
      const focalY = event.focalY - box.value.height / 2;
      scale.value = next;
      offsetX.value = focalX - (focalX - originX.value) * ratio;
      offsetY.value = focalY - (focalY - originY.value) * ratio;
      contain();
    });

  const pan = Gesture.Pan()
    // Two fingers belong to the pinch; a pan with them would fight it.
    .maxPointers(1)
    .onStart(remember)
    .onUpdate((event) => {
      offsetX.value = originX.value + event.translationX;
      offsetY.value = originY.value + event.translationY;
      contain();
    });

  // Separate from the pinch and the pan so a tap only counts when the finger
  // stayed put: both of those move the finger, so neither can end in a tap.
  const tap = Gesture.Tap()
    .maxDuration(320)
    .maxDistance(12)
    .onEnd((_event, settled) => {
      if (settled && onTap) runOnJS(onTap)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, tap)}>
      <View
        style={[StyleSheet.absoluteFill, style]}
        onLayout={(event) => {
          const next = {
            width: event.nativeEvent.layout.width,
            height: event.nativeEvent.layout.height,
          };
          // A resized frame is a different view of the page, so a zoom chosen
          // for the old one no longer means anything.
          if (next.width !== box.value.width || next.height !== box.value.height) reset();
          box.value = next;
        }}>
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
          <Image
            source={{ uri }}
            contentFit="contain"
            style={StyleSheet.absoluteFill}
            accessibilityLabel={accessibilityLabel}
            accessibilityHint="Pinch to zoom, drag to move."
            onLoad={(event) => {
              image.value = { width: event.source.width, height: event.source.height };
            }}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
