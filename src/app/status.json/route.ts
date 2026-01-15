import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Store when the application started
const startTime = new Date();

/**
 * Status JSON API - Shows application and deployment information
 *
 * GET /status.json
 *
 * Returns:
 * - Latest git commit SHA
 * - Latest commit message
 * - Commit datetime
 * - Application uptime
 * - Current server time
 *
 * HTML view available at /status
 */
export async function GET() {
  try {
    // Get git information
    const [shaResult, messageResult, dateResult] = await Promise.all([
      execAsync("git rev-parse HEAD").catch(() => ({ stdout: "unknown", stderr: "" })),
      execAsync("git log -1 --pretty=%B").catch(() => ({ stdout: "unknown", stderr: "" })),
      execAsync("git log -1 --pretty=%ci").catch(() => ({ stdout: "", stderr: "" })),
    ]);

    const sha = shaResult.stdout.trim();
    const shortSha = sha.substring(0, 7);
    const message = messageResult.stdout.trim();
    const commitDate = dateResult.stdout.trim();

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
  } catch (error: any) {
    console.error("[Status] Error generating status:", error);

    return NextResponse.json(
      {
        status: "error",
        error: error.message,
        uptime: {
          started: startTime.toISOString(),
          uptime: Math.floor((Date.now() - startTime.getTime()) / 1000),
        },
      },
      { status: 500 }
    );
  }
}
