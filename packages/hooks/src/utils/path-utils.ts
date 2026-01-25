/**
 * Path Utilities for claude-mem hooks (Issue #297)
 *
 * Provides functions for normalizing file paths to directories,
 * used by SSE-Writer and observation handlers.
 */

import * as path from 'path';

/**
 * Common code file extensions (Issue #297)
 * Used to detect if a path is a file rather than a directory
 */
export const CODE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.py', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.hpp', '.vue', '.svelte',
  '.css', '.scss', '.less', '.html', '.xml', '.yaml', '.yml',
  '.toml', '.ini', '.cfg', '.sh', '.bash', '.zsh',
  '.rb', '.php', '.swift', '.kt', '.kts', '.scala',
  '.r', '.R', '.sql', '.graphql', '.prisma',
];

/**
 * Check if a path appears to be a file based on extension (Issue #297)
 *
 * @param inputPath - The path to check
 * @returns true if the path has a known code file extension
 *
 * @example
 * isLikelyFile('/path/to/file.ts') // true
 * isLikelyFile('/path/to/dir') // false
 * isLikelyFile('/path/to/Makefile') // false (no extension)
 */
export function isLikelyFile(inputPath: string): boolean {
  const ext = path.extname(inputPath).toLowerCase();
  return ext !== '' && CODE_EXTENSIONS.includes(ext);
}

/**
 * Normalize a path to a directory (Issue #297)
 *
 * If the path appears to be a file (based on extension), return its parent directory.
 * Otherwise, return the path unchanged.
 *
 * @param inputPath - The path to normalize
 * @returns The directory path
 *
 * @example
 * normalizeToDirectory('/path/to/file.ts') // '/path/to'
 * normalizeToDirectory('/path/to/dir') // '/path/to/dir'
 */
export function normalizeToDirectory(inputPath: string): string {
  if (isLikelyFile(inputPath)) {
    return path.dirname(inputPath);
  }
  return inputPath;
}
