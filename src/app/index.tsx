/**
 * First-launch entry point.
 *
 * Renders nothing but a redirect. Which route the user lands on is derived from
 * store state during the first render, so there is no effect, no hydration flag,
 * and no frame showing the wrong screen.
 */

import { Redirect } from 'expo-router';

import { useStore } from '@/store/store';

export default function Index() {
  const { state } = useStore();

  if (!state.hasSeenWelcome) {
    return <Redirect href="/(onboarding)/welcome" />;
  }
  if (state.unlockState === 'locked') {
    return <Redirect href="/(onboarding)/unlock" />;
  }
  return <Redirect href="/(tabs)" />;
}
