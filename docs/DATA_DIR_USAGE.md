# DATA_DIR Usage Guide

## Problem
The scripts were not respecting the `DATA_DIR` setting because:
1. Library modules (like `discord-cache.ts`) read `DATA_DIR` from `process.env` at **import time**
2. The `fetch-history.js` wrapper wasn't passing `DATA_DIR` to child processes

## Solution
Now all scripts properly:
1. Show the DATA_DIR path at startup
2. Pass DATA_DIR to child processes
3. Verify you're running from the project root

## Usage

### Default (uses `./data` directory)
```bash
npm run fetch-history
```

### Custom directory (production build)
```bash
DATA_DIR=/path/to/data npm run fetch-history
```

Or for a single script:
```bash
DATA_DIR=/path/to/data npm run fetch-discord
```

### Using .env file
Add to your `.env` file:
```
DATA_DIR=/path/to/data
```

Then run normally:
```bash
npm run fetch-history
```

## Verifying
Each script now shows:
```
📂 DATA_DIR: /absolute/path/to/data
📂 Working directory: /project/root
```

Check these match your expectations!

## Troubleshooting

### Files still going to wrong location?
1. Check the console output - it shows exactly where DATA_DIR points
2. Make sure you're running from the project root (not from `scripts/` folder)
3. If using environment variable, use: `DATA_DIR=/full/path npm run ...`
4. Don't use relative paths like `DATA_DIR=../data` - use absolute paths

### Warning messages
- `⚠️ WARNING: DATA_DIR not set in environment` - This is OK if you want to use `./data`
- `✓ DATA_DIR is set in environment` - DATA_DIR environment variable is active
