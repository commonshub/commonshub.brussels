import * as fs from "fs";
import * as path from "path";
import { DATA_DIR, tierDir } from "./data-paths";

/**
 * The open-data API (/opendata): the `public/` tier of the chb dataset,
 * served to anyone, without a key, for reuse (hackathons, research,
 * journalists). It is a curated subset of that tier, not the whole tree:
 *
 *  - Only the files below. Each was checked against two rules. No file may
 *    name a private individual (organisations and VAT-registered sole
 *    traders may be named, as in expenses); and no file may link a natural
 *    person to an event, a date and a place. That is why chb drops the event
 *    tag and free text of bills from individuals and sole traders in public,
 *    and why `contributors.json` (Discord identities with monthly activity)
 *    and `images.json` (photos taken at the Hub, with their author) are left
 *    out even though some public pages show them.
 *  - Only from `public/`, and the two manifests chb publishes once per
 *    period outside the tiers (`hashes.json`, `vat.json`). Never `members/`,
 *    `stewards/`, `providers/` or `generated/`.
 */

/** Files served from a period's `public/` directory. */
export const OPENDATA_TIER_FILES: Record<string, string> = {
  "transactions.json": "Every transaction: amount, direction, account, category, collective. No counterparty, no bank narration.",
  "counterparties.json": "The Hub's own accounts.",
  "summary.json": "Totals per account, collective and category.",
  "commissions.json": "The monthly fiscal-host commission each collective pays the Hub.",
  "inbound_spreads.json": "Transactions spread over several months: the share landing in this month. No counterparty.",
  "activitygrid.json": "Contributors and photos per month (counts only).",
  "members.json": "Membership summary: counts and totals only, no member list.",
  "door.json": "Door openings: counts only.",
  "events.json": "Events as published on the public calendar: name, times, place, host, cover, url.",
  "events.csv": "One year of events, one row each (no attendance or income columns).",
  "events.md": "Upcoming events, as markdown.",
  "rooms.md": "The rooms and their prices, as markdown.",
  "calendars/public.ics": "Room bookings feed (no person names).",
  "expenses.json": "Every vendor bill, credit note and expense claim, line by line. Organisations and sole traders named; individuals anonymous.",
  "vendors.json": "One row per vendor with totals; individuals merged per category.",
  "customers.json": "One row per customer with totals; only organisations named.",
  "bookings.json": "Room occupancy (room, start, end), room-rental revenue per room.",
  "pending-bills.json": "Bills the Hub still has to pay (the \"help us pay\" list).",
};

/** Files chb writes once per period, outside the tiers, meant to be published. */
export const OPENDATA_ROOT_FILES: Record<string, string> = {
  "hashes.json": "Integrity manifest: per-provider counts and content hashes.",
  "vat.json": "Quarterly VAT declarations filed with the Belgian State.",
};

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);

const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^\d{2}$/;
const SAFE_SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type OpendataPeriod = { year?: string; month?: string; latest?: boolean };

export type OpendataTarget =
  | { kind: "skill" }
  | { kind: "index" }
  | { kind: "listing"; period: OpendataPeriod; label: string }
  | { kind: "file"; fsPath: string; file: string };

function periodLabel(p: OpendataPeriod): string {
  if (p.latest) return "latest";
  return [p.year, p.month].filter(Boolean).join("/");
}

function periodRoot(p: OpendataPeriod): string {
  if (p.latest) return path.join(DATA_DIR, "latest");
  if (p.month) return path.join(DATA_DIR, p.year!, p.month);
  return path.join(DATA_DIR, p.year!);
}

function periodTier(p: OpendataPeriod): string {
  return p.latest ? tierDir("public") : tierDir("public", p.year, p.month);
}

/** Is `file` (relative to a period) something the open-data API serves? */
export function isOpendataFile(file: string): boolean {
  if (OPENDATA_TIER_FILES[file] || OPENDATA_ROOT_FILES[file]) return true;
  // Event cover images, published by the event organisers.
  const parts = file.split("/");
  return (
    parts.length === 3 &&
    parts[0] === "events" &&
    parts[1] === "images" &&
    SAFE_SEGMENT_RE.test(parts[2]) &&
    IMAGE_EXTENSIONS.has(path.extname(parts[2]).toLowerCase())
  );
}

/**
 * Map URL segments under /opendata to what to serve. Returns null for
 * anything outside the allowlist: the caller answers 404.
 */
export function resolveOpendata(segments: string[]): OpendataTarget | null {
  if (segments.some((s) => s === "" || s === "." || s === ".." || s.includes("\\") || s.includes("\0"))) {
    return null;
  }
  if (segments.length === 0) return { kind: "skill" };
  if (segments.length === 1 && segments[0] === "SKILL.md") return { kind: "skill" };
  if (segments.length === 1 && segments[0] === "index.json") return { kind: "index" };

  let period: OpendataPeriod;
  let rest: string[];
  const [first, second] = segments;
  if (first === "latest") {
    period = { latest: true };
    rest = segments.slice(1);
  } else if (YEAR_RE.test(first)) {
    if (second !== undefined && MONTH_RE.test(second)) {
      period = { year: first, month: second };
      rest = segments.slice(2);
    } else {
      period = { year: first };
      rest = segments.slice(1);
    }
  } else {
    return null;
  }

  if (rest.length === 0) return { kind: "listing", period, label: periodLabel(period) };

  const file = rest.join("/");
  if (!isOpendataFile(file)) return null;
  const base = OPENDATA_ROOT_FILES[file] ? periodRoot(period) : periodTier(period);
  const fsPath = path.resolve(base, file);
  if (!fsPath.startsWith(path.resolve(base) + path.sep)) return null;
  return { kind: "file", fsPath, file };
}

export type OpendataListingEntry = { file: string; href: string; bytes: number; description: string };

/** The allowed files that exist for a period. */
export function listOpendataPeriod(period: OpendataPeriod, baseUrl: string): OpendataListingEntry[] {
  const label = periodLabel(period);
  const out: OpendataListingEntry[] = [];
  const add = (dir: string, files: Record<string, string>) => {
    for (const [file, description] of Object.entries(files)) {
      const full = path.join(dir, file);
      try {
        const st = fs.statSync(full);
        if (st.isFile()) out.push({ file, href: `${baseUrl}/opendata/${label}/${file}`, bytes: st.size, description });
      } catch {
        // not there for this period
      }
    }
  };
  add(periodTier(period), OPENDATA_TIER_FILES);
  add(periodRoot(period), OPENDATA_ROOT_FILES);
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

/** Every year and month that has a public tier. */
export function listOpendataPeriods(): Array<{ year: string; months: string[] }> {
  const readDirs = (dir: string, re: RegExp) => {
    try {
      return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && re.test(e.name))
        .map((e) => e.name)
        .sort();
    } catch {
      return [];
    }
  };
  return readDirs(DATA_DIR, YEAR_RE)
    .map((year) => ({
      year,
      months: readDirs(path.join(DATA_DIR, year), MONTH_RE).filter((m) => fs.existsSync(tierDir("public", year, m))),
    }))
    .filter((y) => y.months.length > 0 || fs.existsSync(tierDir("public", y.year)));
}
