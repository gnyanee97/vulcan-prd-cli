# Vulcan PRD CLI

CLI tool for publishing Vulcan data product PRDs to the central repository.

## Installation

```bash
npm install -g vulcan-prd
```

Or use with `npx`:

```bash
npx vulcan-prd publish --domain analytics
```

## Setup

Set your GitHub token (supports both environment variables):

```bash
export VULCAN_PRD_GITHUB_TOKEN=ghp_your_token_here
# or
export GITHUB_TOKEN=ghp_your_token_here
```

Or use GitHub CLI token:

```bash
export VULCAN_PRD_GITHUB_TOKEN=$(gh auth token)
```

## Usage

### Publish a PRD

```bash
vulcan-prd publish --domain analytics
```

**Required:**
- `--domain, -d`: Business domain (analytics, platform, marketing, etc.)

**Optional:**
- `--file, -f`: Path to PRD markdown file (default: `docs/prd.md`)
- `--name, -n`: Product name (auto-extracted from PRD if not provided)
- `--owner-team, -o`: Owner team name
- `--source-repo, -s`: Source repository URL (auto-detected from git remote if not provided)
- `--tags, -t`: Comma-separated tags
- `--repo, -r`: Central PRD repo URL (default: `gnyanee97/vulcan-prds`)
- `--base, -b`: Base branch for PR (default: `main`)
- `--dry-run`: Test without making GitHub changes

### Examples

```bash
# Basic publish (uses default docs/prd.md)
vulcan-prd publish -d analytics

# With explicit file
vulcan-prd publish -f my-prd.md -d analytics

# With explicit product name
vulcan-prd publish -d analytics -n "device360"

# With metadata
vulcan-prd publish \
  -f my-prd.md \
  -d analytics \
  -n "user-engagement" \
  -o "Data Team" \
  -t "analytics,user-engagement,metrics"

# Dry run (test without pushing)
vulcan-prd publish -d analytics --dry-run

# Update existing PRD (upsert)
vulcan-prd publish -f updated-prd.md -d analytics -n "existing-product"
```

## Features

- ✅ **Auto-detection**: Automatically detects source repo from git remote
- ✅ **Upsert support**: Updates existing PRDs instead of failing
- ✅ **Dry-run mode**: Test without making GitHub changes
- ✅ **Flexible naming**: Extract product name from PRD or provide explicitly
- ✅ **Graceful handling**: Creates registry.json if missing
- ✅ **Better branch names**: Includes domain and ISO timestamp format

## How It Works

1. Validates the PRD file format
2. Reads or creates the central repo's `registry.json`
3. Adds/updates PRD to appropriate domain directory
4. Updates `registry.json` with PRD metadata (upsert)
5. Creates a branch with format: `prd/{domain}/{name}-{timestamp}`
6. Commits changes and opens a PR in the central repository

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
npm run dev publish --file prd.md --domain analytics
```

## License

MIT

