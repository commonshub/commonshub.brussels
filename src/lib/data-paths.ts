import * as os from "os";
import * as path from "path";

function resolveDataDir(): string {
  const raw = process.env.DATA_DIR || path.join(process.cwd(), "data");
  // Expand ~ to home directory (shell tilde is not expanded by Node.js)
  if (raw.startsWith("~/")) {
    return path.join(os.homedir(), raw.slice(2));
  }
  return raw;
}

export const DATA_DIR = resolveDataDir();


// ── audience tiers ──────────────────────────────────────────────────────────
//
// chb writes every processed file three times, one directory per audience,
// same file names, strictly less in each lower tier:
//
//   YYYY/MM/public/   YYYY/public/   latest/public/    anyone
//   YYYY/MM/members/  YYYY/members/  latest/members/   the Discord `member` role
//   YYYY/MM/stewards/ …                                 unreadable by this process
//
// A page picks the ONE tier its audience is entitled to and reads the same
// relative path it always did. It never merges tiers, so a public page cannot
// leak a name: the file it opens does not contain one. Design:
// github.com/commonshub/chb/docs/audiences.md.

export type Tier = "public" | "members";

/** The directory a reader opens for a month, a year, or "latest". */
export function tierDir(tier: Tier, year?: string, month?: string): string {
  const base = year ? (month ? path.join(DATA_DIR, year, month) : path.join(DATA_DIR, year)) : path.join(DATA_DIR, "latest");
  return path.join(base, tier);
}

/** Which tier a viewer gets. */
export const tierFor = (isMember: boolean): Tier => (isMember ? "members" : "public");
