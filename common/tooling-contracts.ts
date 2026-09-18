import type { VNode } from 'preact';

export interface MountToolShellOptions {
  title?: string;
  description?: string;
  homeHref?: string;
  headerRootId?: string;
  footerRootId?: string;
  shareRootId?: string;
  showThemeToggle?: boolean;
}

export interface ToolCleanupHandle {
  cleanup: () => void;
}

export interface ToolPrerenderConfig {
  createAppNode: () => VNode;
  createBeforeAppNode?: () => VNode | null;
  createAfterAppNode?: () => VNode | null;
}

export type ToolPrerenderRegistry = Record<string, ToolPrerenderConfig>;
