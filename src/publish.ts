/**
 * PRD publishing logic
 */

import { readFileSync } from 'fs';
import { GitHubClient, type CreatePRParams } from './github.js';
import { validatePrdFile, extractProductName, sanitizeFilename } from './validate.js';
import { getGitRemoteUrl, normalizeRepoUrl } from './git.js';

export interface PublishOptions {
  file: string;
  domain: string;
  productName?: string; // Explicit product name (optional, will extract from PRD if not provided)
  ownerTeam?: string;
  sourceRepo?: string;
  tags?: string[];
  githubToken: string;
  prdRepo?: string; // Format: "owner/repo" or full URL
  baseBranch?: string; // Base branch for PR (default: main)
  dryRun?: boolean; // If true, don't make any GitHub changes
}

export interface PublishResult {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  error?: string;
  dryRun?: boolean;
}

/**
 * Parse PRD repo string to owner/repo
 */
function parseRepo(repo: string): { owner: string; repo: string } {
  // Handle full URL
  if (repo.includes('github.com/')) {
    const match = repo.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
    }
  }
  
  // Handle owner/repo format
  if (repo.includes('/')) {
    const [owner, repoName] = repo.split('/');
    return { owner, repo: repoName.replace(/\.git$/, '') };
  }

  throw new Error(`Invalid repo format: ${repo}. Use "owner/repo" or full GitHub URL`);
}

/**
 * Generate branch name with domain and ISO timestamp
 */
function generateBranchName(domain: string, productName: string): string {
  const sanitized = sanitizeFilename(productName);
  // Use ISO timestamp format (more readable): 2024-01-15T10-30-45-123Z
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `prd/${domain}/${sanitized}-${timestamp}`;
}

/**
 * Upsert registry entry (update if exists, add if new)
 */
function upsertRegistry(registry: any, entry: any): any {
  const items = Array.isArray(registry.items) ? registry.items : [];
  
  const idx = items.findIndex(
    (it: any) => it.prd_path === entry.prd_path || it.product_name === entry.product_name
  );

  if (idx >= 0) {
    // Update existing entry
    items[idx] = { ...items[idx], ...entry, updated_at: new Date().toISOString() };
  } else {
    // Add new entry
    items.push({
      ...entry,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return { ...registry, items };
}

/**
 * Publish PRD to central repository
 */
export async function publishPrd(options: PublishOptions): Promise<PublishResult> {
  try {
    // Validate PRD file
    const validation = validatePrdFile(options.file);
    if (!validation.valid) {
      return {
        success: false,
        error: `PRD validation failed: ${validation.errors.join(', ')}`,
      };
    }

    // Read PRD content
    const prdContent = readFileSync(options.file, 'utf-8');
    
    // Get product name: use explicit name if provided, otherwise extract from PRD
    let productName: string | undefined = options.productName;
    if (!productName) {
      const extracted = extractProductName(prdContent);
      if (!extracted) {
        return {
          success: false,
          error: 'Could not extract product name from PRD. Provide --name or ensure PRD starts with "# PRD: <name>"',
        };
      }
      productName = extracted;
    }

    // Auto-detect source repo if not provided
    let sourceRepo = options.sourceRepo;
    if (!sourceRepo) {
      const gitRemote = getGitRemoteUrl();
      const normalized = normalizeRepoUrl(gitRemote);
      sourceRepo = normalized || undefined;
    }

    // Parse repo
    const repoUrl = options.prdRepo || 'gnyanee97/vulcan-prds';
    const { owner, repo } = parseRepo(repoUrl);

    // Initialize GitHub client
    const github = new GitHubClient({
      token: options.githubToken,
      owner,
      repo,
    });

    // Get base branch (default to 'main', but can be overridden)
    const baseBranch = options.baseBranch || 'main';
    
    // Generate filename and path
    const filename = `${sanitizeFilename(productName)}.md`;
    const prdPath = `prds/${options.domain}/${filename}`;

    // Read current registry (or create new one if missing)
    let registryContent = await github.getFile('registry.json', baseBranch);
    let registry: any;
    
    if (registryContent) {
      try {
        registry = JSON.parse(registryContent);
      } catch {
        // Invalid JSON, create new registry
        registry = { version: '1', items: [] };
      }
    } else {
      // Registry doesn't exist, create new one
      registry = { version: '1', items: [] };
    }

    // Prepare registry entry
    const entry = {
      product_name: productName,
      domain: options.domain,
      owner_team: options.ownerTeam || '',
      source_repo: sourceRepo || '',
      prd_path: prdPath,
      tags: options.tags || [],
    };

    // Upsert registry (update if exists, add if new)
    const updatedRegistry = upsertRegistry(registry, entry);
    const isUpdate = registry.items.some(
      (item: any) => item.prd_path === prdPath || item.product_name === productName
    );

    // Generate branch name
    const branchName = generateBranchName(options.domain, productName);

    // Prepare PR params
    const prTitle = isUpdate ? `Update PRD: ${productName}` : `Add PRD: ${productName}`;
    const prBody = [
      `## ${isUpdate ? 'Update' : 'Add'} PRD: ${productName}`,
      '',
      `**Domain:** ${options.domain}`,
      options.ownerTeam ? `**Owner Team:** ${options.ownerTeam}` : '',
      sourceRepo ? `**Source Repo:** ${sourceRepo}` : '',
      options.tags && options.tags.length > 0 ? `**Tags:** ${options.tags.join(', ')}` : '',
      '',
      `This PR ${isUpdate ? 'updates' : 'adds'} a data product PRD to the central repository.`,
      '',
      '### Changes',
      `- ${isUpdate ? 'Updated' : 'Added'} PRD file: \`${prdPath}\``,
      `- Updated \`registry.json\` with PRD metadata`,
      '',
      '### Next Steps',
      '- Review PRD content',
      '- Merge PR to add to index',
      '- PRD will be automatically indexed after merge',
    ].filter(Boolean).join('\n');

    const prParams: CreatePRParams = {
      branch: branchName,
      title: prTitle,
      body: prBody,
      files: [
        {
          path: prdPath,
          content: prdContent,
          message: `${isUpdate ? 'Update' : 'Add'} PRD: ${options.domain}/${productName}`,
        },
        {
          path: 'registry.json',
          content: JSON.stringify(updatedRegistry, null, 2) + '\n',
          message: `Update registry for PRD: ${options.domain}/${productName}`,
        },
      ],
    };

    // Dry run mode - just return success without making changes
    if (options.dryRun) {
      return {
        success: true,
        dryRun: true,
      };
    }

    // Create branch and PR
    await github.createBranch(branchName, baseBranch);
    
    // Create/update all files
    for (const file of prParams.files) {
      await github.createOrUpdateFile(file.path, file.content, file.message, branchName);
    }

    // Create PR
    const pr = await github.createPullRequest(prParams.title, prParams.body, branchName, baseBranch);

    return {
      success: true,
      prUrl: pr.url,
      prNumber: pr.number,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

