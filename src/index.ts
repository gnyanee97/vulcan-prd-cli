#!/usr/bin/env node
/**
 * Vulcan PRD CLI
 * 
 * CLI tool for publishing Vulcan data product PRDs to the central repository
 */

import { Command } from 'commander';
import { publishPrd } from './publish.js';
import { getGitRemoteUrl, normalizeRepoUrl } from './git.js';
import { existsSync } from 'fs';
import { resolve } from 'path';

const program = new Command();

program
  .name('vulcan-prd')
  .description('CLI tool for publishing Vulcan data product PRDs to the central repository')
  .version('1.0.0');

program
  .command('publish')
  .description('Publish a PRD to the central repository')
  .option('-f, --file <file>', 'Path to PRD markdown file (default: docs/prd.md)', 'docs/prd.md')
  .requiredOption('-d, --domain <domain>', 'Business domain (analytics, platform, marketing, etc.)')
  .option('-n, --name <name>', 'Product name (optional, will extract from PRD if not provided)')
  .option('-o, --owner-team <team>', 'Owner team name')
  .option('-s, --source-repo <repo>', 'Source repository URL (auto-detected from git remote if not provided)')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .option('-r, --repo <repo>', 'Central PRD repo (default: gnyanee97/vulcan-prds)', 'gnyanee97/vulcan-prds')
  .option('-b, --base <branch>', 'Base branch for PR (default: main)', 'main')
  .option('--dry-run', 'Test without making GitHub changes', false)
  .action(async (options) => {
    // Get GitHub token (support both env vars)
    const githubToken = process.env.VULCAN_PRD_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error('❌ Error: GitHub token environment variable is required');
      console.error('');
      console.error('Set it with one of:');
      console.error('  export VULCAN_PRD_GITHUB_TOKEN=ghp_your_token_here');
      console.error('  export GITHUB_TOKEN=ghp_your_token_here');
      console.error('');
      console.error('Or use GitHub CLI:');
      console.error('  export VULCAN_PRD_GITHUB_TOKEN=$(gh auth token)');
      process.exit(1);
    }

    // Validate file exists
    const filePath = resolve(process.cwd(), options.file);
    if (!existsSync(filePath)) {
      console.error(`❌ Error: PRD file not found: ${options.file}`);
      console.error(`   Looked for: ${filePath}`);
      process.exit(1);
    }

    // Parse tags
    const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined;

    // Validate domain
    const validDomains = ['analytics', 'platform', 'marketing', 'finance', 'operations'];
    const domain = options.domain.toLowerCase();
    if (!validDomains.includes(domain)) {
      console.warn(`⚠️  Warning: Domain "${options.domain}" is not in standard list: ${validDomains.join(', ')}`);
    }

    // Auto-detect source repo if not provided
    let sourceRepo = options.sourceRepo;
    if (!sourceRepo) {
      const gitRemote = getGitRemoteUrl();
      sourceRepo = normalizeRepoUrl(gitRemote) || undefined;
    }

    // Display info
    console.log('\n🧾 Publishing PRD');
    console.log(`   File: ${filePath}`);
    console.log(`   Domain: ${domain}`);
    if (options.name) console.log(`   Name: ${options.name}`);
    if (options.ownerTeam) console.log(`   Owner: ${options.ownerTeam}`);
    if (sourceRepo) console.log(`   Source: ${sourceRepo}`);
    if (tags) console.log(`   Tags: ${tags.join(', ')}`);
    console.log(`   Central repo: ${options.repo}`);
    console.log(`   Base branch: ${options.base}`);
    if (options.dryRun) {
      console.log(`   Mode: DRY RUN (no GitHub changes will be made)`);
    }
    console.log('');

    const result = await publishPrd({
      file: filePath,
      domain,
      productName: options.name,
      ownerTeam: options.ownerTeam,
      sourceRepo,
      tags,
      githubToken,
      prdRepo: options.repo,
      baseBranch: options.base,
      dryRun: options.dryRun,
    });

    if (result.success) {
      if (result.dryRun) {
        console.log('✅ Dry run complete. (No changes pushed.)\n');
      } else {
        console.log('✅ PRD published successfully!');
        console.log('');
        console.log(`🔗 PR #${result.prNumber}: ${result.prUrl}`);
        console.log('');
        console.log('Your PRD is ready for review. Once merged, it will be automatically indexed.');
      }
    } else {
      console.error('❌ Failed to publish PRD:');
      console.error(`   ${result.error}`);
      process.exit(1);
    }
  });

// Parse arguments
program.parse();

