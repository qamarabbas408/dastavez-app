/**
 * Simulated camera.
 *
 * There is no camera permission request and no camera access. The viewport is
 * a drawn stand-in, and the shutter pulls a seeded page from the store. When the
 * `permissionDenied` developer switch is on, this screen shows the
 * explanation-and-return state instead, which is the state a reviewer needs to
 * see without actually revoking a permission.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/atoms/button';
import { AppIcon } from '@/components/atoms/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/store';

export default function CapturePreviewScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useStore();
  const [flashOn, setFlashOn] = useState(false);

  if (state.failures.permissionDenied) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <TopBar onClose={() => router.replace('/(tabs)')} label="Close" />
        <View style={[styles.permissionBody, { paddingBottom: insets.bottom + Spacing.four }]}>
          <View style={[styles.permissionIcon, { backgroundColor: theme.accentSoft }]}>
            <AppIcon name="camera" size={34} color={theme.accent} />
          </View>
          <Text accessibilityRole="header" style={[styles.permissionTitle, { color: theme.text }]}>
            Dastavez cannot use the camera
          </Text>
          <Text style={[styles.permissionText, { color: theme.textSecondary }]}>
            Without camera access, pages cannot be captured. This prototype never requests it, so
            nothing was blocked and no setting was changed.
          </Text>
          <Text style={[styles.permissionNote, { color: theme.textSecondary }]}>
            The developer switch “Camera permission denied” is forcing this screen.
          </Text>
          <Button
            label="Back to Home"
            variant="primary"
            fullWidth
            onPress={() => router.replace('/(tabs)')}
          />
        </View>
      </View>
    );
  }

  const shutter = () => {
    // One seeded page per shutter press; Page Review handles adding more.
    dispatch({ type: 'draft/startScan', pageCount: 1 });
    router.push('/scan/page-review');
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.viewfinder }]}>
      <TopBar onClose={() => router.back()} label="Close" tone="inverted" flashOn={flashOn} onToggleFlash={() => setFlashOn((on) => !on)} />

      <View style={styles.viewport}>
        <View style={styles.guide}>
          <View style={[styles.corner, styles.cornerTopLeft, { borderColor: '#FFFFFF' }]} />
          <View style={[styles.corner, styles.cornerTopRight, { borderColor: '#FFFFFF' }]} />
          <View style={[styles.corner, styles.cornerBottomLeft, { borderColor: '#FFFFFF' }]} />
          <View style={[styles.corner, styles.cornerBottomRight, { borderColor: '#FFFFFF' }]} />
        </View>
        <Text style={styles.viewportLabel}>Mock viewfinder</Text>
        <Text style={styles.viewportNote}>
          No camera is started and no image is captured. The shutter creates a placeholder page.
        </Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Capture page"
          onPress={shutter}
          style={({ pressed }) => [styles.shutter, pressed && { opacity: 0.7 }]}>
          <View style={styles.shutterInner} />
        </Pressable>
        <Text style={styles.controlsHint}>Shutter adds a page and opens Page Review</Text>
      </View>
    </View>
  );
}

function TopBar({
  onClose,
  label,
  tone = 'default',
  flashOn,
  onToggleFlash,
}: {
  onClose: () => void;
  label: string;
  tone?: 'default' | 'inverted';
  flashOn?: boolean;
  onToggleFlash?: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inverted = tone === 'inverted';
  const color = inverted ? '#FFFFFF' : theme.text;

  return (
    <View style={[styles.topBar, { paddingTop: insets.top + Spacing.three }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onClose}
        hitSlop={10}
        style={({ pressed }) => [styles.topBarButton, pressed && { opacity: 0.6 }]}>
        <AppIcon name="close" size={22} color={color} accessibilityLabel={label} />
      </Pressable>
      <Text style={[styles.topBarTitle, { color }]}>Scan</Text>
      <View style={styles.topBarButton}>
        {onToggleFlash ? (
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Flash"
            accessibilityState={{ checked: !!flashOn }}
            onPress={onToggleFlash}
            hitSlop={10}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <AppIcon
              name="flash"
              size={20}
              color={flashOn ? theme.accent : color}
              accessibilityLabel="Flash"
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  topBarButton: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: 17, fontWeight: '600' },
  viewport: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  guide: { width: '100%', maxWidth: 420, aspectRatio: 0.72 },
  corner: { position: 'absolute', width: 34, height: 34 },
  cornerTopLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTopRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  viewportLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.4 },
  viewportNote: { color: '#A7B0BD', fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 320 },
  controls: { alignItems: 'center', paddingTop: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.three },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF' },
  controlsHint: { color: '#A7B0BD', fontSize: 13 },
  permissionBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  permissionIcon: {
    width: 68,
    height: 68,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  permissionTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  permissionText: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
  permissionNote: { fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
});
