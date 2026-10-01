/**
 * First launch: what Dastavez is, and what it cannot promise.
 *
 * The BYOD limitation is stated plainly rather than buried. A document scanner
 * that says "your documents stay on your device" has to be honest that the
 * operating system, screenshots, and a compromised phone are outside its
 * control — overclaiming here would make the rest of the app's privacy
 * promises untrustworthy.
 */

import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { AppIcon } from '@/components/atoms/icon';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/store';

const LIMITATIONS = [
  'Dastavez cannot control operating system backups.',
  'Screenshots can capture whatever is on screen.',
  'Where an exported file goes depends on the app you share it with.',
  'A compromised or unlocked phone is outside its control.',
] as const;

export default function WelcomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { dispatch } = useStore();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
        ]}>
        <View style={styles.hero}>
          <View style={[styles.mark, { backgroundColor: theme.accentSoft }]}>
            <AppIcon name="scan" size={40} color={theme.accent} />
          </View>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
            Dastavez
          </Text>
          <Text style={[styles.tagline, { color: theme.accent }]}>Offline Document Scanner</Text>
        </View>

        <Text style={[styles.lead, { color: theme.text }]}>
          Scan a document and it stays on this device. No account, no upload, no cloud.
        </Text>

        <Card>
          <View style={styles.cardHeader}>
            <AppIcon name="warning" size={20} color={theme.warning} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>What this app cannot promise</Text>
          </View>
          <View style={styles.list}>
            {LIMITATIONS.map((line) => (
              <View key={line} style={styles.listItem}>
                <View style={[styles.bullet, { backgroundColor: theme.textSecondary }]} />
                <Text style={[styles.listText, { color: theme.textSecondary }]}>{line}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Button
          label="Continue"
          variant="primary"
          size="regular"
          fullWidth
          onPress={() => {
            dispatch({ type: 'welcome/complete' });
            router.replace('/(onboarding)/unlock');
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  hero: { alignItems: 'center', gap: Spacing.two },
  mark: {
    width: 84,
    height: 84,
    borderRadius: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  title: { fontSize: 34, fontWeight: '700', textAlign: 'center' },
  tagline: { fontSize: 16, fontWeight: '600', letterSpacing: 0.3, textAlign: 'center' },
  lead: { fontSize: 17, lineHeight: 25, textAlign: 'center' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  cardTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  list: { gap: Spacing.two },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 8 },
  listText: { flex: 1, fontSize: 14, lineHeight: 21 },
});
