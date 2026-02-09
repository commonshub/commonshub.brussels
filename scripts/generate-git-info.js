#!/usr/bin/env node
/**
 * Generate git info for builds where .git directory is not available
 * Writes to git-info.json which next.config.mjs can read
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getGitInfo() {
  try {
    // Try to get git info from commands
    const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const message = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
    const date = execSync('git log -1 --pretty=%ci', { encoding: 'utf8' }).trim();
    return { sha, message, date, source: 'git' };
  } catch (e) {
    // Fall back to environment variables
    return {
      sha: process.env.SOURCE_COMMIT || process.env.GIT_COMMIT_SHA || 'unknown',
      message: process.env.GIT_COMMIT_MESSAGE || 'unknown',
      date: process.env.GIT_COMMIT_DATE || new Date().toISOString(),
      source: 'env'
    };
  }
}

const gitInfo = getGitInfo();
const outputPath = path.join(__dirname, '..', 'git-info.json');

fs.writeFileSync(outputPath, JSON.stringify(gitInfo, null, 2));
console.log(`Generated git-info.json (source: ${gitInfo.source}):`, gitInfo);
