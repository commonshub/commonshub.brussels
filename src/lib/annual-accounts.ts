import * as fs from "fs";
import * as path from "path";
import { tierDir } from "./data-paths";

/**
 * The association's annual accounts as filed with the National Bank, from
 * chb (≥ 3.20, docs/annual-accounts.md): YYYY/public/annual-accounts.json per
 * year the fiscal period ends, latest/public/annual-accounts.json for all.
 * Public files list filed fiscal years only, with the abbreviated statements.
 */
export interface AnnualAccountsCheck {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
  amount?: number;
}

export interface FiscalYear {
  label: string;
  year: string;
  period: { start: string; end: string; months: number; startAssumed?: boolean };
  status: "filed" | "draft";
  filedAt?: string | null;
  nbb?: { reference?: string; url?: string };
  currency: string;
  keyFigures: Partial<Record<KeyFigure, number>>;
  documents: Array<{ kind: string; file: string; path: string; sha256: string; bytes: number }>;
  checks: AnnualAccountsCheck[];
}

export type KeyFigure =
  | "totalAssets" | "fixedAssets" | "currentAssets" | "receivables" | "cash" | "equity" | "accumulatedResult"
  | "amountsPayable" | "turnover" | "giftsAndSubsidies" | "goodsAndServices" | "remuneration" | "grossMargin"
  | "operatingResult" | "resultOfThePeriod" | "broughtForward" | "carriedForward" | "otherAppropriations";

/** The key figures a reader needs, in reading order, with their NBB codes. */
export const KEY_FIGURE_ROWS: Array<{ key: KeyFigure; label: string; code: string; group: "balance" | "result" }> = [
  { key: "totalAssets", label: "Total assets", code: "20/58", group: "balance" },
  { key: "cash", label: "Cash at bank and in hand", code: "54/58", group: "balance" },
  { key: "receivables", label: "Amounts receivable within one year", code: "40/41", group: "balance" },
  { key: "equity", label: "Equity", code: "10/15", group: "balance" },
  { key: "amountsPayable", label: "Amounts payable", code: "17/49", group: "balance" },
  { key: "turnover", label: "Turnover", code: "70", group: "result" },
  { key: "giftsAndSubsidies", label: "Membership fees, gifts and subsidies", code: "73", group: "result" },
  { key: "goodsAndServices", label: "Goods and services", code: "60/61", group: "result" },
  { key: "remuneration", label: "Remuneration and social security", code: "62", group: "result" },
  { key: "operatingResult", label: "Operating result", code: "9901", group: "result" },
  { key: "resultOfThePeriod", label: "Result of the period", code: "9904", group: "result" },
];

function read(file: string): FiscalYear[] {
  try {
    return (JSON.parse(fs.readFileSync(file, "utf-8")) as { fiscalYears?: FiscalYear[] }).fiscalYears ?? [];
  } catch {
    return [];
  }
}

/** Filed fiscal years whose period ends in `year`. */
export function readAnnualAccounts(year: string): FiscalYear[] {
  return read(path.join(tierDir("public", year), "annual-accounts.json")).filter((f) => f.status === "filed");
}

/** Every filed fiscal year, newest first. */
export function readAllAnnualAccounts(): FiscalYear[] {
  return read(path.join(tierDir("public"), "annual-accounts.json"))
    .filter((f) => f.status === "filed")
    .sort((a, b) => b.period.end.localeCompare(a.period.end));
}

/** Where the open-data API serves a document: /opendata/YYYY/annual-accounts/<file>. */
export function documentHref(doc: { path: string }): string {
  return `/opendata/${doc.path.replace(/^(\d{4})\/public\//, "$1/")}`;
}
