import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/atoms/icon';
import { Banner } from '@/components/atoms/banner';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/store';

/**
 * Shared screen chrome for every non-tab screen: a back affordance in the
 * header, consistent horizontal padding, a width cap so text stays readable on
 * tablets, and safe-area padding top and bottom.
 *
 * The header is a plain row rather than a native stack header so the prototype
 * controls back behaviour itself (several screens need to intercept Back to ask
 * about unsaved work). That also means it has to apply the top safe-area inset
 * itself — the native stack header would otherwise have done it, and the back
 * button would end up underneath the status bar.
 */
export function Screen({
  title,
  subtitle,
  children,
  showBack = true,
  onBack,
  scrollable = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  scrollable?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useStore();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const body = (
    <View
      style={[
        styles.content,
        // Clears the home indicator, plus the tab bar when a task screen is
        // pushed above the tabs.
        { paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
      ]}>
      {state.status ? (
        <Banner
          tone={state.status.tone}
          title={state.status.text}
          action={{ label: 'Dismiss', onPress: () => dispatch({ type: 'status/clear' }) }}
        />
      ) : null}
      {children}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          {
            borderBottomColor: theme.border,
            paddingTop: insets.top + Spacing.three,
          },
        ]}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={handleBack}
            hitSlop={8}
            style={({ pressed }) => [styles.back, { opacity: pressed ? 0.6 : 1 }]}>
            <AppIcon name="chevron-left" size={22} color={theme.accent} accessibilityLabel="Go back" />
          </Pressable>
        ) : (
          <View style={styles.backSpacer} />
        )}
        <View style={styles.headerText}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>

      {scrollable ? (
        <View style={styles.scrollArea}>
          {body}
        </View>
      ) : (
        body
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  backSpacer: { width: Spacing.three },
  headerText: { flex: 1, gap: Spacing.half },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 14 },
  scrollArea: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});