/**
 * PRD publishing logic
 */

import { readFileSync } from 'fs';
import { GitHubClient, type CreatePRParams } from './github';
import { validatePrdFile, extractProductName, sanitizeFilename } from './validate';

export interface PublishOptions {
  file: string;
  domain: string;
  ownerTeam?: string;
  sourceRepo?: string;
  tags?: string[];
  githubToken: string;
  prdRepo?: string; // Format: "owner/repo" or full URL
}

export interface PublishResult {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  error?: string;
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
 * Generate branch name
 */
function generateBranchName(productName: string): string {
  const sanitized = sanitizeFilename(productName);
  const timestamp = Date.now();
  return `prd/${sanitized}-${timestamp}`;
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
    const productName = extractProductName(prdContent);
    
    if (!productName) {
      return {
        success: false,
        error: 'Could not extract product name from PRD. Ensure it starts with "# PRD: <name>"',
      };
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

    // Read current registry
    const registryContent = await github.getFile('registry.json');
    if (!registryContent) {
      return {
        success: false,
        error: 'Could not read registry.json from central repo',
      };
    }

    const registry = JSON.parse(registryContent);
    
    // Generate filename
    const filename = `${sanitizeFilename(productName)}.md`;
    const prdPath = `prds/${options.domain}/${filename}`;

    // Check if PRD already exists
    const existingPrd = registry.items.find(
      (item: any) => item.prd_path === prdPath || item.product_name === productName
    );
    
    if (existingPrd) {
      return {
        success: false,
        error: `PRD already exists: ${existingPrd.product_name} at ${existingPrd.prd_path}`,
      };
    }

    // Prepare new registry entry
    const newEntry = {
      product_name: productName,
      domain: options.domain,
      owner_team: options.ownerTeam || 'TBD',
      source_repo: options.sourceRepo || 'TBD',
      prd_path: prdPath,
      tags: options.tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Update registry
    registry.items.push(newEntry);

    // Generate branch name
    const branchName = generateBranchName(productName);

    // Prepare PR params
    const prParams: CreatePRParams = {
      branch: branchName,
      title: `Add PRD: ${productName}`,
      body: `## PRD: ${productName}

**Domain:** ${options.domain}
${options.ownerTeam ? `**Owner Team:** ${options.ownerTeam}` : ''}
${options.sourceRepo ? `**Source Repo:** ${options.sourceRepo}` : ''}
${options.tags && options.tags.length > 0 ? `**Tags:** ${options.tags.join(', ')}` : ''}

This PR adds a new data product PRD to the central repository.

### Changes
- Added PRD file: \`${prdPath}\`
- Updated \`registry.json\` with PRD metadata

### Next Steps
- Review PRD content
- Merge PR to add to index
- PRD will be automatically indexed after merge`,
      files: [
        {
          path: prdPath,
          content: prdContent,
          message: `Add PRD: ${productName}`,
        },
        {
          path: 'registry.json',
          content: JSON.stringify(registry, null, 2) + '\n',
          message: `Update registry: Add ${productName}`,
        },
      ],
    };

    // Create PR
    const pr = await github.createPR(prParams);

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

