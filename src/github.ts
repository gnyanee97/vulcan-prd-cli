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
      throw error;
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(branchName: string, baseBranch: string): Promise<void> {
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

