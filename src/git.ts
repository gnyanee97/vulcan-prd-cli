/**
 * Git utility functions
 */

import { execSync } from 'child_process';

/**
 * Get git remote origin URL
 */
export function getGitRemoteUrl(): string | null {
  try {
    const url = execSync('git config --get remote.origin.url', {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8',
    }).trim();
    return url || null;
  } catch {
    return null;
  }
}

/**
 * Normalize repository URL to GitHub HTTPS format
 * Supports both SSH (git@github.com:org/repo.git) and HTTPS (https://github.com/org/repo.git)
 */
export function normalizeRepoUrl(remote: string | null): string | null {
  if (!remote) return null;

  // SSH format: git@github.com:org/repo.git
  if (remote.startsWith('git@')) {
    const match = remote.match(/git@github\.com:([^/]+)\/(.+?)(\.git)?$/);
    if (match) {
      return `https://github.com/${match[1]}/${match[2]}`;
    }
  }

  // HTTPS format: https://github.com/org/repo.git
  if (remote.startsWith('https://')) {
    return remote.replace(/\.git$/, '');
  }

  return remote;
}


