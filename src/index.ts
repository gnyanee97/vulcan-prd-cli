#!/usr/bin/env node
/**
 * Vulcan PRD CLI
 * 
 * CLI tool for publishing Vulcan data product PRDs to the central repository
 */

import { Command } from 'commander';
import { publishPrd } from './publish.js';

const program = new Command();

program
  .name('vulcan-prd')
  .description('CLI tool for publishing Vulcan data product PRDs')
  .version('1.0.0');

program
  .command('publish')
  .description('Publish a PRD to the central repository')
  .requiredOption('-f, --file <file>', 'Path to PRD markdown file')
  .requiredOption('-d, --domain <domain>', 'Business domain (analytics, platform, marketing, etc.)')
  .option('-o, --owner-team <team>', 'Owner team name')
  .option('-s, --source-repo <repo>', 'Source repository URL')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .option('-r, --repo <repo>', 'Central PRD repo (default: gnyanee97/vulcan-prds)', 'gnyanee97/vulcan-prds')
  .action(async (options) => {
    // Get GitHub token
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error('❌ Error: GITHUB_TOKEN environment variable is required');
      console.error('');
      console.error('Set it with:');
      console.error('  export GITHUB_TOKEN=ghp_your_token_here');
      console.error('');
      console.error('Or use GitHub CLI:');
      console.error('  export GITHUB_TOKEN=$(gh auth token)');
      process.exit(1);
    }

    // Parse tags
    const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined;

    // Validate domain
    const validDomains = ['analytics', 'platform', 'marketing', 'finance', 'operations'];
    if (!validDomains.includes(options.domain.toLowerCase())) {
      console.warn(`⚠️  Warning: Domain "${options.domain}" is not in standard list: ${validDomains.join(', ')}`);
    }

    console.log('📝 Publishing PRD...');
    console.log(`   File: ${options.file}`);
    console.log(`   Domain: ${options.domain}`);
    if (options.ownerTeam) console.log(`   Owner: ${options.ownerTeam}`);
    if (options.sourceRepo) console.log(`   Source: ${options.sourceRepo}`);
    if (tags) console.log(`   Tags: ${tags.join(', ')}`);
    console.log('');

    const result = await publishPrd({
      file: options.file,
      domain: options.domain.toLowerCase(),
      ownerTeam: options.ownerTeam,
      sourceRepo: options.sourceRepo,
      tags,
      githubToken,
      prdRepo: options.repo,
    });

    if (result.success) {
      console.log('✅ PRD published successfully!');
      console.log('');
      console.log(`🔗 PR #${result.prNumber}: ${result.prUrl}`);
      console.log('');
      console.log('Your PRD is ready for review. Once merged, it will be automatically indexed.');
    } else {
      console.error('❌ Failed to publish PRD:');
      console.error(`   ${result.error}`);
      process.exit(1);
    }
  });

// Parse arguments
program.parse();

