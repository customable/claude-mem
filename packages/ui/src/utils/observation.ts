/**
 * Shared utilities for observation display
 */

/**
 * Observation type configuration for UI rendering
 */
export const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string; emoji: string }> = {
  // Work Types
  bugfix: { icon: 'ph--bug', color: 'text-error', label: 'Bug Fix', emoji: '🔴' },
  feature: { icon: 'ph--star', color: 'text-secondary', label: 'Feature', emoji: '🟣' },
  refactor: { icon: 'ph--arrows-clockwise', color: 'text-info', label: 'Refactor', emoji: '🔄' },
  change: { icon: 'ph--check-circle', color: 'text-success', label: 'Change', emoji: '✅' },
  // Documentation & Config
  docs: { icon: 'ph--file-text', color: 'text-base-content', label: 'Documentation', emoji: '📝' },
  config: { icon: 'ph--gear', color: 'text-base-content/80', label: 'Config', emoji: '⚙️' },
  // Quality & Testing
  test: { icon: 'ph--test-tube', color: 'text-accent', label: 'Test', emoji: '🧪' },
  security: { icon: 'ph--shield-check', color: 'text-error', label: 'Security', emoji: '🔒' },
  performance: { icon: 'ph--lightning', color: 'text-warning', label: 'Performance', emoji: '⚡' },
  // Infrastructure
  deploy: { icon: 'ph--rocket-launch', color: 'text-primary', label: 'Deployment', emoji: '🚀' },
  infra: { icon: 'ph--buildings', color: 'text-neutral', label: 'Infrastructure', emoji: '🏗️' },
  migration: { icon: 'ph--database', color: 'text-info', label: 'Migration', emoji: '🔀' },
  // Knowledge Types
  discovery: { icon: 'ph--magnifying-glass', color: 'text-primary', label: 'Discovery', emoji: '🔵' },
  decision: { icon: 'ph--scales', color: 'text-warning', label: 'Decision', emoji: '⚖️' },
  research: { icon: 'ph--flask', color: 'text-primary', label: 'Research', emoji: '🔬' },
  // Integration
  api: { icon: 'ph--plugs-connected', color: 'text-secondary', label: 'API', emoji: '🔌' },
  integration: { icon: 'ph--link', color: 'text-accent', label: 'Integration', emoji: '🔗' },
  dependency: { icon: 'ph--package', color: 'text-base-content/70', label: 'Dependency', emoji: '📦' },
  // Planning & Tasks
  task: { icon: 'ph--check-square', color: 'text-accent', label: 'Task', emoji: '☑️' },
  plan: { icon: 'ph--list-checks', color: 'text-info', label: 'Plan', emoji: '📋' },
  // Session
  'session-request': { icon: 'ph--chat-text', color: 'text-base-content/60', label: 'Request', emoji: '💬' },
};

/** Get type config with fallback */
export function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || { icon: 'ph--dot', color: 'text-base-content', label: type, emoji: '•' };
}

/** Parse JSON string safely */
export function parseJsonArray(str?: string): string[] {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Check if string looks like a URL instead of a file path */
export function isUrl(str: string): boolean {
  return str.startsWith('http://') || str.startsWith('https://') || str.includes('://');
}

/** Separate file paths and URLs */
export function separatePathsAndUrls(items: string[]): { paths: string[]; urls: string[] } {
  const paths: string[] = [];
  const urls: string[] = [];
  for (const item of items) {
    if (isUrl(item)) {
      urls.push(item);
    } else {
      paths.push(item);
    }
  }
  return { paths, urls };
}

/** Shorten file path for display */
export function shortenPath(path: string): string {
  const parts = path.split('/');
  if (parts.length <= 4) return path;
  return '.../' + parts.slice(-3).join('/');
}

/** Extract domain from URL */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url;
  }
}
