/**
 * API route to get membership data
 * 
 * GET /api/members - Returns members.json for current month
 * GET /api/members?year=2026&month=01 - Returns members.json for specific month
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import type { MembersFile } from "@/types/members";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Default to current month
  const now = new Date();
  const year = searchParams.get("year") || String(now.getFullYear());
  const month = searchParams.get("month") || String(now.getMonth() + 1).padStart(2, "0");

  const membersPath = path.join(DATA_DIR, year, month.padStart(2, "0"), "members.json");

  if (!fs.existsSync(membersPath)) {
    return NextResponse.json(
      { error: "Members data not found for this month" },
      { status: 404 }
    );
  }

  try {
    const content = fs.readFileSync(membersPath, "utf-8");
    const data: MembersFile = JSON.parse(content);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error reading members data:", error);
    return NextResponse.json(
      { error: "Failed to read members data" },
      { status: 500 }
    );
  }
}
