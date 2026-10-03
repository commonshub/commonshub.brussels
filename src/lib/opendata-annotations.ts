import * as fs from "fs";
import * as path from "path";
import { tierDir } from "./data-paths";

/**
 * What an agent needs to know to read the open dataset right, kept as data
 * so it does not go stale in prose:
 *
 *  - Annotations: one-off events in the data (a test mint, a hack, a change
 *    of method), one per month and section. Served at
 *    /opendata/annotations.json, attached to the rows of monthly.json, and
 *    rendered by the skill and the .md pages for the months they show.
 *    chb takes over the list by writing latest/public/annotations.json;
 *    until it does, the list below is used.
 *  - Coverage: from when each section of monthly.json actually holds data,
 *    computed from the data itself (see opendata-monthly.ts).
 *  - Upstream issues: known bugs in files chb produces. Each one is deleted
 *    here once fixed in chb.
 */

export type OpendataAnnotation = {
  /** YYYY-MM */
  month: string;
  /** The monthly.json section it affects: money, expenses, invoicedIncome, bookings, activity, door, members, tokens.CHT … */
  section: string;
  /** incident (a real event worth knowing), test (not real activity), method (how the data is recorded changed). */
  kind: "incident" | "test" | "method";
  note: string;
};

export const DEFAULT_OPENDATA_ANNOTATIONS: OpendataAnnotation[] = [
  {
    month: "2025-01",
    section: "tokens.CHT",
    kind: "test",
    note: "Test mint of 10⁶ CHT, burnt again the same month. Since chb 3.26 the mint and burn are marked metadata.excluded and left out of every total.",
  },
  {
    month: "2025-09",
    section: "tokens.CHT",
    kind: "test",
    note: "Test mint of 2×10¹² CHT, burnt again the same month (three burns). Since chb 3.26 they are marked metadata.excluded and left out of every total.",
  },
  {
    month: "2026-01",
    section: "expenses",
    kind: "method",
    note: "Expense categories switch from Odoo account classes (\"Services and other goods\", \"Balance sheet\") to custom tags (\"furniture\", \"cold-drinks\"); both can appear in one month. Compare years with lines[].account.code, not category.",
  },
  {
    month: "2026-05",
    section: "money",
    kind: "incident",
    note: "One outflow of about €110k EURe from the account 202605-savings-hacked: a real loss, which dominates any 2026 total.",
  },
];

/** The annotations chb publishes, or the built-in list until it does. Oldest first. */
export function loadOpendataAnnotations(): OpendataAnnotation[] {
  let list = DEFAULT_OPENDATA_ANNOTATIONS;
  try {
    const data = JSON.parse(fs.readFileSync(path.join(tierDir("public"), "annotations.json"), "utf8"));
    if (Array.isArray(data?.annotations)) list = data.annotations;
  } catch {
    // not published by chb yet
  }
  return [...list].sort((a, b) => a.month.localeCompare(b.month));
}

export const OPENDATA_ANNOTATION_KINDS: Record<OpendataAnnotation["kind"], string> = {
  incident: "a real event that distorts totals: mention it rather than averaging over it",
  test: "not real activity: exclude it",
  method: "how the data is recorded changed: do not compare across it naively",
};

/** Bugs in the files chb produces. Delete an entry once fixed in chb. */
export type OpendataUpstreamIssue = { title: string; detail: string; workaround: string; url?: string };

export const OPENDATA_UPSTREAM_ISSUES: OpendataUpstreamIssue[] = [
  {
    title: "summary.json counts transfers between the Hub's own accounts as income and spending",
    detail:
      "collectives[] includes INTERNAL rows (savings → checking, Stripe payouts), so /latest/summary.json gives commonshub a lifetime EUR \"end balance\" of hundreds of thousands of euros. It is not a bank balance.",
    workaround: "Use monthly.json money, or sum transactions.json without INTERNAL and TRANSFER rows. Real balances: /finance.",
  },
  {
    title: "summary.json accounts[] and currencies[] miss on-chain euros",
    detail: "EURe movements on Gnosis (Monerium mints and burns, which carry rent, catering and many incoming payments) show in: 0, out: 0.",
    workaround: "Use monthly.json money, which counts them.",
  },
];

/** The annotations of the given months, for one section prefix (e.g. "tokens" matches "tokens.CHT"). */
export function annotationsFor(annotations: OpendataAnnotation[], months: string[], section?: string): OpendataAnnotation[] {
  const wanted = new Set(months);
  return annotations.filter(
    (a) => wanted.has(a.month) && (!section || a.section === section || a.section.startsWith(`${section}.`))
  );
}
