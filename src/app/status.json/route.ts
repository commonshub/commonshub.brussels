import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Store when the application started (runtime)
const startTime = new Date();

// Read git info at runtime (file is updated by entrypoint)
function getGitInfoRuntime() {
  const paths = [
    join(process.cwd(), 'git-info.json'),
    '/app/git-info.json',
  ];
  
  for (const path of paths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf8');
        return JSON.parse(content);
      } catch { /* ignore */ }
    }
  }
  
  // Fallback to env vars
  return {
    sha: process.env.SOURCE_COMMIT || process.env.NEXT_PUBLIC_GIT_SHA || 'unknown',
    message: process.env.COOLIFY_BRANCH || process.env.NEXT_PUBLIC_GIT_MESSAGE || 'unknown',
    date: process.env.NEXT_PUBLIC_GIT_DATE || new Date().toISOString(),
  };
}

/**
 * Status JSON API - Shows application and deployment information
 *
 * GET /status.json
 *
 * Returns:
 * - Latest git commit SHA (captured at build time)
 * - Latest commit message (captured at build time)
 * - Commit datetime (captured at build time)
 * - Build time
 * - Application uptime
 * - Current server time
 *
 * HTML view available at /status
 */
export async function GET() {
  try {
    // Git info is read at runtime from git-info.json (updated by entrypoint)
    const gitInfo = getGitInfoRuntime();
    const sha = gitInfo.sha || "unknown";
    const shortSha = sha !== "unknown" ? sha.substring(0, 7) : "unknown";
    const message = gitInfo.message || "unknown";
    const commitDate = gitInfo.date || "";
    const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || "";

    // Calculate uptime
    const now = new Date();
    const uptimeMs = now.getTime() - startTime.getTime();
    const uptimeSeconds = Math.floor(uptimeMs / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    const uptimeDays = Math.floor(uptimeHours / 24);

    // Format uptime as human-readable string
    let uptimeFormatted = "";
    if (uptimeDays > 0) {
      uptimeFormatted += `${uptimeDays}d `;
    }
    if (uptimeHours % 24 > 0 || uptimeDays > 0) {
      uptimeFormatted += `${uptimeHours % 24}h `;
    }
    if (uptimeMinutes % 60 > 0 || uptimeHours > 0) {
      uptimeFormatted += `${uptimeMinutes % 60}m `;
    }
    uptimeFormatted += `${uptimeSeconds % 60}s`;

    // Get timezone from environment or default to Europe/Brussels
    const timezone = process.env.TZ || "Europe/Brussels";

    // Format dates in the configured timezone
    const formatInTimezone = (date: Date) => {
      return date.toLocaleString("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    };

    const response = {
      status: "ok",
      deployment: {
        sha: sha,
        shortSha: shortSha,
        message: message,
        commitDate: commitDate,
        commitDateFormatted: commitDate ? formatInTimezone(new Date(commitDate)) : null,
      },
      build: {
        time: buildTime,
        timeFormatted: buildTime ? formatInTimezone(new Date(buildTime)) : null,
      },
      uptime: {
        started: startTime.toISOString(),
        startedFormatted: formatInTimezone(startTime),
        uptime: uptimeFormatted,
        uptimeSeconds: uptimeSeconds,
      },
      server: {
        time: now.toISOString(),
        timeFormatted: formatInTimezone(now),
        timezone: timezone,
      },
      environment: process.env.NODE_ENV || "development",
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Status] Error generating status:", error);

    return NextResponse.json(
      {
        status: "error",
        error: errorMessage,
        uptime: {
          started: startTime.toISOString(),
          uptime: Math.floor((Date.now() - startTime.getTime()) / 1000),
        },
      },
      { status: 500 }
    );
  }
}
