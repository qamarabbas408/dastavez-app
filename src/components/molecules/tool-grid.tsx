/**
 * The tool shortcuts, as tiles.
 *
 * A thin adapter over `IconTileGrid`: it turns a tool's optional destination
 * into a press handler, so the grid itself stays presentational.
 */

import { router, type Href } from 'expo-router';

import { IconTileGrid } from './icon-tile-grid';

import type { Tool } from '@/constants/tools';

export function ToolGrid({ tools }: { tools: Tool[] }) {
  return (
    <IconTileGrid
      tiles={tools.map((tool) => {
        const href: Href | undefined = tool.href;
        return {
          icon: tool.icon,
          label: tool.label,
          onPress: href ? () => router.navigate(href) : undefined,
        };
      })}
    />
  );
}
