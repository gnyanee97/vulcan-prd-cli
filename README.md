# Vulcan PRD CLI

CLI tool for publishing Vulcan data product PRDs to the central repository.

## Installation

```bash
npm install -g vulcan-prd
```

Or use with `npx`:

```bash
npx vulcan-prd publish --file prd.md --domain analytics
```

## Setup

Set your GitHub token:

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

Or use GitHub CLI token:

```bash
export GITHUB_TOKEN=$(gh auth token)
```

## Usage

### Publish a PRD

```bash
vulcan-prd publish --file prd.md --domain analytics
```

Options:
- `--file, -f`: Path to PRD markdown file (required)
- `--domain, -d`: Business domain (analytics, platform, marketing, etc.) (required)
- `--owner-team, -o`: Owner team name (optional)
- `--source-repo, -s`: Source repository URL (optional)
- `--tags, -t`: Comma-separated tags (optional)
- `--repo, -r`: Central PRD repo URL (default: gnyanee97/vulcan-prds)

### Examples

```bash
# Basic publish
vulcan-prd publish -f my-prd.md -d analytics

# With metadata
vulcan-prd publish \
  -f my-prd.md \
  -d analytics \
  -o "Data Team" \
  -s "https://github.com/org/my-project" \
  -t "analytics,user-engagement,metrics"
```

## How It Works

1. Validates the PRD file format
2. Reads the central repo's `registry.json`
3. Adds PRD to appropriate domain directory
4. Updates `registry.json` with PRD metadata
5. Creates a branch and commits changes
6. Opens a PR in the central repository

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

