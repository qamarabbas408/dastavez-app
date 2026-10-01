/**
 * Import source chooser.
 *
 * Photos are real: the system photo library opens and the chosen images become
 * pages in a draft. PDFs are still simulated, because turning a PDF into page
 * images needs a rasteriser and none has been chosen yet — that screen says so
 * in plain language.
 *
 * The library picker does not require a permission prompt on iOS or modern
 * Android, so none is requested here.
 *
 * Selected files are deliberately *not* copied into app storage at this point.
 * Copying on pick would leave orphaned files behind every time a draft is
 * cancelled; the copy happens when the document is saved instead.
 */

import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, type IconName } from '@/components/atoms/icon';
import { Screen } from '@/components/molecules/screen';
import { Radius, Spacing, touchTarget } from '@/constants/theme';
import { toDataError } from '@/data/errors';
import { newId } from '@/data/ids';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/store';

export default function ImportSourceScreen() {
  const theme = useTheme();
  const { dispatch } = useStore();
  const [importing, setImporting] = useState(false);

  const pickPhotos = async () => {
    if (importing) return;
    setImporting(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (result.canceled) return;

      const pages = result.assets.map((asset) => ({ id: newId('page'), uri: asset.uri }));
      dispatch({ type: 'draft/startImportImages', pages, title: titleFrom(result.assets) });
      router.push('/edit-save');
    } catch (error) {
      const failure = toDataError(error, 'read-failed');
      if (__DEV__) console.warn('Photo import failed', failure);

      dispatch({
        type: 'status/set',
        status: { tone: 'danger', text: 'Those photos could not be added. Nothing was changed.' },
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Screen title="Import" subtitle="Bring in a document you already have">
      <SourceRow
        icon="image"
        title="Photos"
        detail="Choose pictures from this device."
        onPress={pickPhotos}
        disabled={importing}
        busy={importing}
      />
      <SourceRow
        icon="document"
        title="PDFs"
        detail="Add the pages of an existing PDF. Still simulated."
        onPress={() => router.push('/import/picker')}
        disabled={importing}
      />

      <Text style={[styles.note, { color: theme.textSecondary }]}>
        Photos are copied into Dastavez&rsquo;s own storage when you save, and stay on this device. PDF
        import remains sample data for now, because rendering a PDF into page images needs a component
        that has not been chosen yet.
      </Text>
    </Screen>
  );
}

/** Uses the first file name as a starting title, minus its extension. */
function titleFrom(assets: ImagePicker.ImagePickerAsset[]): string | undefined {
  const name = assets[0]?.fileName;
  if (!name) return undefined;
  return name.replace(/\.[^.]+$/, '');
}

function SourceRow({
  icon,
  title,
  detail,
  onPress,
  disabled,
  busy = false,
}: {
  icon: IconName;
  title: string;
  detail: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityState={{ disabled: !!disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          opacity: disabled && !busy ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.accentSoft }]}>
        {busy ? (
          <ActivityIndicator color={theme.accent} />
        ) : (
          <AppIcon name={icon} size={24} color={theme.accent} />
        )}
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          {busy ? 'Adding photos…' : title}
        </Text>
        <Text style={[styles.cardDetail, { color: theme.textSecondary }]}>{detail}</Text>
      </View>
      {busy ? null : <AppIcon name="chevron-right" size={18} color={theme.textSecondary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: touchTarget.min + 12,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: Spacing.half },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardDetail: { fontSize: 14, lineHeight: 20 },
  note: { fontSize: 13, fontStyle: 'italic', lineHeight: 19 },
});
