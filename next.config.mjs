import { execSync } from 'child_process';

// Capture git info at build time
function getGitInfo() {
  try {
    const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const message = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
    const date = execSync('git log -1 --pretty=%ci', { encoding: 'utf8' }).trim();
    return { sha, message, date };
  } catch (e) {
    // Fallback for environments without git (e.g., Docker without .git)
    return {
      sha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || 'unknown',
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE || process.env.GIT_COMMIT_MESSAGE || 'unknown',
      date: process.env.VERCEL_GIT_COMMIT_DATE || process.env.GIT_COMMIT_DATE || new Date().toISOString(),
    };
  }
}

const gitInfo = getGitInfo();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    loader: 'custom',
    loaderFile: './src/lib/image-loader.mjs',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      }
    ],
    formats: ['image/avif', 'image/webp'],
    unoptimized: false,
  },
  // Expose git info as build-time environment variables
  env: {
    NEXT_PUBLIC_GIT_SHA: gitInfo.sha,
    NEXT_PUBLIC_GIT_MESSAGE: gitInfo.message,
    NEXT_PUBLIC_GIT_DATE: gitInfo.date,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
}

export default nextConfig
