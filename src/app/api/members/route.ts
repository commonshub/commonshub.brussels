/**
 * API route to get membership data
 *
 * Reads pre-generated data from data/{year}/{month}/members.json
 * Use /api/sync to refresh data on demand.
 *
 * GET /api/members              → current month
 * GET /api/members?year=2026&month=01 → specific month
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import type { MembersFile } from "@/types/members";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = searchParams.get("year") || String(now.getFullYear());
  const month = (searchParams.get("month") || String(now.getMonth() + 1)).padStart(2, "0");

  const membersPath = path.join(DATA_DIR, year, month, "members.json");

  if (!fs.existsSync(membersPath)) {
    return NextResponse.json(
      { error: "Members data not found for this month. Try calling /api/sync first." },
      { status: 404 }
    );
  }

  try {
    const data: MembersFile = JSON.parse(fs.readFileSync(membersPath, "utf-8"));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to read members data" }, { status: 500 });
  }
}
