/**
 * Document View: the pages, full screen, the way a scanner shows them.
 *
 * The page gets the whole screen; everything else is chrome drawn over it. The
 * top bar carries the title and the page counter, the bottom bar carries the
 * page strip and the actions, and a tap on the page hides both. Both sit in a
 * single overlay rather than in the layout, so hiding them never resizes the
 * stage — a zoom the user has chosen survives the toggle — and the stage pads
 * itself to the measured bar height so the page is never hidden behind it.
 * Delete hangs on its own below the top bar, kept away from the actions it is
 * easiest to hit by accident.
 *
 * Recognised text is deliberately not reachable from here. The panel it used to
 * live in is gone rather than left empty.
 */

import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Banner } from '@/components/atoms/banner';
import { Button } from '@/components/atoms/button';
import { AppIcon, type IconName } from '@/components/atoms/icon';
import { ConfirmDialog } from '@/components/atoms/confirm-dialog';
import { PagePreview } from '@/components/molecules/page-preview';
import { ZoomableImage } from '@/components/molecules/zoomable-image';
import {
  MaxContentWidth,
  Radius,
  Spacing,
  ViewerColors,
  touchTarget,
} from '@/constants/theme';
import { deleteDocument, getDocument } from '@/data/documents';
import { toDataError } from '@/data/errors';
import { useAsyncData } from '@/data/use-async';
import { useStore } from '@/store/store';

const THUMB_WIDTH = 56;

export default function DocumentViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { dispatch } = useStore();
  const insets = useSafeAreaInsets();

  const [pageIndex, setPageIndex] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [barHeight, setBarHeight] = useState(0);
  const [topBarHeight, setTopBarHeight] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // The fade is derived from the same flag that drives `pointerEvents`, so
  // there is no separate animated value to keep in step with the render.
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: withTiming(chromeVisible ? 1 : 0, { duration: 160 }),
  }));

  const load = useCallback(() => getDocument(db, id), [db, id]);
  const { status, data: document, error, reload } = useAsyncData(load);

  // An edit returns here with `back`, so this screen never remounts — yet the
  // record has changed and the page files behind it may have been rewritten.
  // Reading again on focus is what picks that up. `reload` deliberately does
  // not go back to `loading`, so the current page stays on screen.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const toggleChrome = () => setChromeVisible((visible) => !visible);

  const edit = () => {
    if (!document) return;
    dispatch({ type: 'draft/startEdit', document });
    router.push('/edit-save');
  };

  const remove = async () => {
    if (!document || deleting) return;
    setDeleting(true);
    try {
      await deleteDocument(db, document.id);
      setConfirmDelete(false);
      dispatch({ type: 'status/set', status: { tone: 'info', text: 'Document deleted.' } });
      back();
    } catch (cause) {
      const failure = toDataError(cause, 'write-failed');
      if (__DEV__) console.warn('Delete failed', failure);
      setConfirmDelete(false);
      dispatch({
        type: 'status/set',
        status: { tone: 'danger', text: 'That document could not be deleted. Nothing was changed.' },
      });
    } finally {
      setDeleting(false);
    }
  };

  const pages = document?.pages ?? [];
  const page = pages[Math.min(pageIndex, pages.length - 1)];
  const counter = `${Math.min(pageIndex + 1, pages.length)}/${pages.length}`;

  return (
    <View style={styles.root}>
      {/* The system bar would be dark text on this dark screen. */}
      <StatusBar style="light" hidden={!chromeVisible} />

      <View style={[styles.stage, { paddingBottom: barHeight }]}>
        {status === 'loading' ? (
          <ActivityIndicator color={ViewerColors.text} />
        ) : status === 'error' ? (
          <View style={styles.message}>
            <Banner
              tone="danger"
              title="Could not open this document"
              message={error.message}
              action={{ label: 'Try again', onPress: reload }}
            />
          </View>
        ) : !document ? (
          <View style={styles.message}>
            <Text style={[styles.messageTitle, { color: ViewerColors.text }]}>
              That document is no longer in the library
            </Text>
            <Text style={[styles.messageBody, { color: ViewerColors.textSecondary }]}>
              It may have been deleted from this device.
            </Text>
            <Button label="Back to Home" variant="primary" onPress={back} />
          </View>
        ) : page ? (
          // Saved pages are already baked — rotation and filter went into the
          // file at save time — so the stored image is what gets shown. Keyed
          // by page so switching pages starts the zoom over.
          <ZoomableImage
            key={page.id}
            uri={page.uri}
            accessibilityLabel={`Page ${pageIndex + 1} of ${pages.length}`}
            onTap={toggleChrome}
          />
        ) : null}
      </View>

      <Animated.View
        style={[StyleSheet.absoluteFill, chromeStyle]}
        pointerEvents={chromeVisible ? 'box-none' : 'none'}>
        <View
          onLayout={(event) => setTopBarHeight(event.nativeEvent.layout.height)}
          style={[
            styles.topBar,
            { paddingTop: insets.top + Spacing.two, paddingBottom: Spacing.two },
          ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={back}
            hitSlop={8}
            style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}>
            <AppIcon name="chevron-left" size={24} color={ViewerColors.text} />
          </Pressable>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={[styles.title, { color: ViewerColors.text }]}>
            {document?.title ?? 'Document'}
          </Text>
          <View style={styles.counterSlot}>
            {pages.length > 0 ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.counter, { color: ViewerColors.textSecondary }]}>
                {counter}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Destructive, so it sits apart from the export actions at the bottom.
            Measured off the top bar rather than positioned by a constant: the
            safe-area inset is part of that bar's height. */}
        {document && topBarHeight > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete this document"
            accessibilityState={{ disabled: deleting }}
            disabled={deleting}
            onPress={() => setConfirmDelete(true)}
            style={({ pressed }) => [
              styles.floatingDelete,
              { top: topBarHeight + Spacing.three },
              pressed && { opacity: 0.6 },
              deleting && { opacity: 0.4 },
            ]}>
            <AppIcon name="trash" size={22} color={ViewerColors.danger} />
          </Pressable>
        ) : null}

        {document ? (
          <View
            onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)}
            style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.two }]}>
            {pages.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbs}>
                {pages.map((item, index) => {
                  const selected = index === pageIndex;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Page ${index + 1}`}
                      onPress={() => setPageIndex(index)}
                      style={({ pressed }) => [
                        styles.thumb,
                        { borderColor: selected ? ViewerColors.accent : ViewerColors.border },
                        pressed && { opacity: 0.6 },
                      ]}>
                      <PagePreview page={item} width={THUMB_WIDTH} compact />
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            <View style={styles.actions}>
              <ViewerAction
                icon="document"
                label="Export PDF"
                onPress={() =>
                  router.push({
                    pathname: '/document/[id]/export-confirm',
                    params: { id: document.id, format: 'pdf' },
                  })
                }
              />
              <ViewerAction
                icon="image"
                label="Export JPEG"
                onPress={() =>
                  router.push({
                    pathname: '/document/[id]/export-confirm',
                    params: { id: document.id, format: 'jpeg' },
                  })
                }
              />
              <ViewerAction icon="pencil" label="Edit" onPress={edit} />
            </View>
          </View>
        ) : null}
      </Animated.View>

      {document ? (
        <ConfirmDialog
          visible={confirmDelete}
          title={`Delete “${document.title}”?`}
          message={`All ${pages.length} ${pages.length === 1 ? 'page' : 'pages'} will be removed from this device. This cannot be undone.`}
          confirmLabel={deleting ? 'Deleting…' : 'Delete'}
          destructive
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
        />
      ) : null}
    </View>
  );
}

function ViewerAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}>
      <AppIcon name={icon} size={24} color={ViewerColors.text} />
      <Text numberOfLines={1} style={[styles.actionLabel, { color: ViewerColors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ViewerColors.background },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
    alignItems: 'center',
  },
  messageTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  messageBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    backgroundColor: ViewerColors.chrome,
  },
  back: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  counterSlot: {
    width: touchTarget.min,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: touchTarget.min,
  },
  counter: { fontSize: 14, fontWeight: '700' },

  floatingDelete: {
    position: 'absolute',
    right: Spacing.three,
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: touchTarget.min / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ViewerColors.chrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ViewerColors.border,
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.two,
    paddingTop: Spacing.two,
    backgroundColor: ViewerColors.chrome,
  },
  thumbs: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.half,
  },
  thumb: {
    borderRadius: Radius.small,
    borderWidth: 2,
    padding: Spacing.half,
  },
  actions: { flexDirection: 'row', paddingHorizontal: Spacing.two },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minHeight: touchTarget.min,
    paddingVertical: Spacing.two,
  },
  actionLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
