/**
 * Git Utilities for Repository Detection
 *
 * Provides functions to detect git repositories and worktrees,
 * enabling proper project identification across multiple working directories.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';

/**
 * Information about a git repository and its worktree status
 */
export interface RepoInfo {
  /** Canonical repository path (main worktree) */
  repoPath: string;
  /** Current worktree path */
  worktreePath: string;
  /** Whether this is a worktree (not main) */
  isWorktree: boolean;
  /** Current branch name */
  branch: string;
  /** Remote origin URL (if available) */
  remoteUrl: string | null;
  /** Repository name (derived from path or remote) */
  repoName: string;
}

/**
 * Check if a directory is inside a git repository
 */
export function isGitRepo(cwd: string): boolean {
  try {
    execSync('git rev-parse --git-dir', {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the root directory of the git repository
 */
export function getGitRoot(cwd: string): string | null {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Get comprehensive repository information including worktree detection
 */
export function getRepoInfo(cwd: string): RepoInfo | null {
  try {
    // First check if we're in a git repo
    if (!isGitRepo(cwd)) {
      return null;
    }

    // Get current working tree root
    const worktreePath = execSync('git rev-parse --show-toplevel', {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    }).trim();

    // Get the common git directory (same for all worktrees of a repo)
    const gitCommonDir = execSync('git rev-parse --git-common-dir', {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    }).trim();

    // Determine if this is a worktree by checking if .git is a file (worktree) or directory (main)
    const gitPath = join(worktreePath, '.git');
    let repoPath = worktreePath;
    let isWorktree = false;

    if (existsSync(gitPath)) {
      const stat = statSync(gitPath);
      if (stat.isFile()) {
        // This is a worktree - .git is a file pointing to the main repo
        isWorktree = true;
        // Parse the main worktree path from git worktree list
        try {
          const worktreeList = execSync('git worktree list --porcelain', {
            cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
            encoding: 'utf-8',
          });
          // First worktree in the list is always the main one
          const firstLine = worktreeList.split('\n')[0];
          if (firstLine.startsWith('worktree ')) {
            repoPath = firstLine.replace('worktree ', '').trim();
          }
        } catch {
          // Fallback: derive from gitCommonDir
          // gitCommonDir is typically /path/to/main/repo/.git
          if (gitCommonDir.endsWith('/.git')) {
            repoPath = dirname(gitCommonDir);
          }
        }
      }
    }

    // Get current branch
    let branch = '';
    try {
      branch = execSync('git branch --show-current', {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
      }).trim();

      // If no branch (detached HEAD), get the short SHA
      if (!branch) {
        branch = execSync('git rev-parse --short HEAD', {
          cwd,
          stdio: ['pipe', 'pipe', 'pipe'],
          encoding: 'utf-8',
        }).trim();
      }
    } catch {
      branch = 'unknown';
    }

    // Get remote origin URL
    let remoteUrl: string | null = null;
    try {
      remoteUrl = execSync('git remote get-url origin', {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
      }).trim();
    } catch {
      // No remote origin - that's fine
    }

    // Derive repository name
    const repoName = deriveRepoName(repoPath, remoteUrl);

    return {
      repoPath,
      worktreePath,
      isWorktree,
      branch,
      remoteUrl,
      repoName,
    };
  } catch {
    return null;
  }
}

/**
 * Derive a repository name from path or remote URL
 */
function deriveRepoName(repoPath: string, remoteUrl: string | null): string {
  // Try to get name from remote URL first
  if (remoteUrl) {
    // Handle various URL formats:
    // https://github.com/user/repo.git
    // git@github.com:user/repo.git
    // ssh://git@host/user/repo.git
    const match = remoteUrl.match(/[\/:]([^\/]+?)(?:\.git)?$/);
    if (match) {
      return match[1];
    }
  }

  // Fallback to directory name
  return basename(repoPath);
}

/**
 * Get the canonical project identifier for a working directory
 *
 * This returns a consistent identifier regardless of whether the
 * directory is the main repo or a worktree.
 */
export function getProjectIdentifier(cwd: string): string {
  const repoInfo = getRepoInfo(cwd);
  if (repoInfo) {
    // Use the main repository path as the project identifier
    return repoInfo.repoPath;
  }
  // Not a git repo - use the directory path as-is
  return cwd;
}

/**
 * Get project identifier with branch suffix for worktrees
 *
 * Useful when you want to track worktrees separately but still
 * group them under the same repository.
 */
export function getProjectIdentifierWithBranch(cwd: string): string {
  const repoInfo = getRepoInfo(cwd);
  if (repoInfo) {
    if (repoInfo.isWorktree) {
      return `${repoInfo.repoPath}@${repoInfo.branch}`;
    }
    return repoInfo.repoPath;
  }
  return cwd;
}
