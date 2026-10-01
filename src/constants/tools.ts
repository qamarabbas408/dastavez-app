/**
 * Tool definitions shared by Home's shortcut grid and the Tools tab.
 *
 * Presentation only for now: none of these features is built, so only the "All"
 * shortcut has a destination. Giving a tool an `href` is what makes its tile
 * behave like a live control rather than being announced as unavailable.
 */

import type { Href } from 'expo-router';

import type { IconName } from '@/components/atoms/icon';

export type Tool = {
  icon: IconName;
  label: string;
  href?: Href;
};

/** Everything Dastavez intends to offer. */
export const ALL_TOOLS: Tool[] = [
  { icon: 'scan', label: 'Smart Scan' },
  { icon: 'image', label: 'Import Images' },
  { icon: 'document', label: 'PDF Tools' },
  { icon: 'folder', label: 'Import Files' },
  { icon: 'card', label: 'Cards' },
  { icon: 'text', label: 'Extract Text' },
];

/** Home shows the same set plus a shortcut to the full list. */
export const HOME_TOOLS: Tool[] = [
  ...ALL_TOOLS,
  { icon: 'grid', label: 'All', href: '/tools' },
];
