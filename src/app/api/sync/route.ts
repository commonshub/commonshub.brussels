/**
 * /api/sync — Run fetch-members script on demand
 *
 * GET /api/sync              → fetch current month
 * GET /api/sync?backfill=1   → fetch all historical months
 *
 * Runs the fetch-members.ts script as a child process.
 */

import { NextResponse } from "next/server";
import { execSync } from "child_process";
import * as path from "path";

export const maxDuration = 300; // 5 min max for Vercel/Coolify

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const backfill = searchParams.get("backfill") === "1";

  const scriptPath = path.join(process.cwd(), "scripts", "fetch-members.ts");
  const args = backfill ? "--backfill" : "";

  try {
    const output = execSync(`npx tsx ${scriptPath} ${args}`, {
      timeout: 4 * 60 * 1000, // 4 min timeout
      encoding: "utf-8",
      env: { ...process.env },
      cwd: process.cwd(),
    });

    return NextResponse.json({
      ok: true,
      mode: backfill ? "backfill" : "current-month",
      output: output.split("\n").filter(Boolean).slice(-20), // last 20 lines
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        output: (err.stdout || "").split("\n").filter(Boolean).slice(-20),
        stderr: (err.stderr || "").split("\n").filter(Boolean).slice(-10),
      },
      { status: 500 }
    );
  }
}
