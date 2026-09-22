/**
 * API route to get membership data
 *
 * Reads chb's members.json from the viewer's tier: the public tier carries
 * the summary only (members: []), the members tier the roster.
 *
 * GET /api/members                    → latest
 * GET /api/members?year=2026&month=01 → specific month
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import type { MembersFile } from "@/types/members";
import { isMember } from "@/lib/admin-check";
import { tierFor, type Tier } from "@/lib/data-paths";
import { listMonths, listYears, tierFile } from "@/lib/dataset";
import { membershipEnabled } from "@/lib/membership";

// Reads the dataset volume and the session, so never prerender it.
export const dynamic = "force-dynamic";

/** The newest month that has a members.json in this tier, else latest/. */
function findLatestMembersPath(tier: Tier): string | null {
  for (const year of listYears().reverse()) {
    for (const month of listMonths(year, tier).reverse()) {
      const candidate = tierFile(tier, "members.json", year, month);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  const latest = tierFile(tier, "members.json");
  return fs.existsSync(latest) ? latest : null;
}

export async function GET(request: Request) {
  // A host without EMAIL_HASH_SALT cannot identify a member, so it does not
  // serve member data at all rather than serving a roster it cannot connect
  // anyone to. See @/lib/membership.
  if (!membershipEnabled()) {
    return NextResponse.json({ error: "Membership is not configured on this host." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  if ((year && !/^\d{4}$/.test(year)) || (month && !/^\d{1,2}$/.test(month))) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  const tier = tierFor(await isMember());
  const membersPath = year && month ? tierFile(tier, "members.json", year, month.padStart(2, "0")) : findLatestMembersPath(tier);

  if (!membersPath || !fs.existsSync(membersPath)) {
    return NextResponse.json({ error: "Members data not found." }, { status: 404 });
  }

  try {
    const data: MembersFile = JSON.parse(fs.readFileSync(membersPath, "utf-8"));
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to read members data" }, { status: 500 });
  }
}
