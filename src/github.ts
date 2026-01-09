/**
 * GitHub API client for creating PRs
 */

import { Octokit } from '@octokit/rest';

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export interface CreatePRParams {
  branch: string;
  title: string;
  body: string;
  files: Array<{
    path: string;
    content: string;
    message: string;
  }>;
}

export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(config: GitHubConfig) {
    this.octokit = new Octokit({ auth: config.token });
    this.owner = config.owner;
    this.repo = config.repo;
  }

  /**
   * Verify token has access to the repository
   */
  async verifyAccess(): Promise<{ hasRead: boolean; hasWrite: boolean; error?: string }> {
    try {
      // Test read access
      await this.octokit.repos.get({
        owner: this.owner,
        repo: this.repo,
      });

      // Test write access by checking if we can get refs (requires write for private repos)
      try {
        await this.octokit.git.getRef({
          owner: this.owner,
          repo: this.repo,
          ref: 'heads/main',
        });
        return { hasRead: true, hasWrite: true };
      } catch (error: any) {
        if (error.status === 403) {
          return { hasRead: true, hasWrite: false, error: 'Token lacks write permissions' };
        }
        return { hasRead: true, hasWrite: false, error: error.message };
      }
    } catch (error: any) {
      if (error.status === 404) {
        return { hasRead: false, hasWrite: false, error: `Repository ${this.owner}/${this.repo} not found or not accessible` };
      }
      if (error.status === 401 || error.status === 403) {
        return { hasRead: false, hasWrite: false, error: 'Token is invalid or lacks required permissions' };
      }
      return { hasRead: false, hasWrite: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Get default branch (usually 'main')
   */
  async getDefaultBranch(): Promise<string> {
    const { data } = await this.octokit.repos.get({
      owner: this.owner,
      repo: this.repo,
    });
    return data.default_branch;
  }

  /**
   * Get file content from repository
   */
  async getFile(path: string, ref?: string): Promise<string | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref,
      });

      if ('content' in data && 'encoding' in data) {
        return Buffer.from(data.content, data.encoding as BufferEncoding).toString('utf-8');
      }
      return null;
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      if (error.status === 403 || error.status === 401) {
        throw new Error(
          `Permission denied accessing ${this.owner}/${this.repo}. ` +
          `Ensure your GitHub token has read access to the repository. ` +
          `Original error: ${error.message || error.toString()}`
        );
      }
      throw error;
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(branchName: string, baseBranch: string): Promise<void> {
    try {
      // Get SHA of base branch
      const { data: refData } = await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${baseBranch}`,
      });

      const baseSha = refData.object.sha;

      // Create new branch
      await this.octokit.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      });
    } catch (error: any) {
      if (error.status === 403 || error.status === 404) {
        const is403 = error.status === 403;
        const errorMsg = is403
          ? `Permission denied: Your GitHub token doesn't have write access to ${this.owner}/${this.repo}`
          : `Repository not found or not accessible: ${this.owner}/${this.repo}`;
        
        throw new Error(
          `${errorMsg}\n\n` +
          `To fix this:\n` +
          `1. Ensure your GitHub token has the 'repo' scope (for private repos) or 'public_repo' scope (for public repos)\n` +
          `2. Verify you have write access to ${this.owner}/${this.repo}\n` +
          `3. If the repo is private, make sure your token has access to it\n` +
          `4. Create a new token at https://github.com/settings/tokens with appropriate permissions\n\n` +
          `Original error: ${error.message || error.toString()}`
        );
      }
      throw error;
    }
  }

  /**
   * Create or update file in repository
   */
  async createOrUpdateFile(
    path: string,
    content: string,
    message: string,
    branch: string
  ): Promise<void> {
    try {
      // Check if file exists
      let sha: string | undefined;
      try {
        const { data } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path,
          ref: branch,
        });
        if ('sha' in data) {
          sha = data.sha;
        }
      } catch (error: any) {
        if (error.status !== 404) {
          throw error;
        }
        // File doesn't exist, will create new
      }

      const contentBase64 = Buffer.from(content, 'utf-8').toString('base64');

      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        content: contentBase64,
        branch,
        sha,
      });
    } catch (error: any) {
      if (error.status === 403 || error.status === 404) {
        throw new Error(
          `Permission denied: Cannot write to ${this.owner}/${this.repo}. ` +
          `Ensure your GitHub token has write access. ` +
          `Original error: ${error.message || error.toString()}`
        );
      }
      throw error;
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    title: string,
    body: string,
    head: string,
    base: string
  ): Promise<{ number: number; url: string }> {
    const { data } = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      head,
      base,
    });

    return {
      number: data.number,
      url: data.html_url,
    };
  }

  /**
   * Create PR with multiple file changes
   * @deprecated Use createBranch, createOrUpdateFile, and createPullRequest separately for more control
   */
  async createPR(params: CreatePRParams): Promise<{ number: number; url: string }> {
    const defaultBranch = await this.getDefaultBranch();

    // Create branch
    await this.createBranch(params.branch, defaultBranch);

    // Create/update all files
    for (const file of params.files) {
      await this.createOrUpdateFile(file.path, file.content, file.message, params.branch);
    }

    // Create PR
    const pr = await this.createPullRequest(params.title, params.body, params.branch, defaultBranch);

    return pr;
  }
}

