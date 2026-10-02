import * as fs from "fs";
import * as path from "path";
import { tierDir } from "./data-paths";
import { listOpendataPeriods } from "./opendata";
import { loadOpendataAnnotations, type OpendataAnnotation } from "./opendata-annotations";

/**
 * The monthly time series of the open dataset (/opendata/monthly.json and
 * /opendata/{YYYY}/monthly.json): one row per month, built from the small
 * per-month files of the public tier, so a chart takes one request instead
 * of one per month. Only aggregates leave this module: transactions.json is
 * summed, never copied.
 *
 * Money is summed from transactions.json rather than copied from
 * summary.json: summary's `currencies` leaves out on-chain EURe flows, and
 * its `collectives` counts transfers between the Hub's own accounts as
 * income.
 *
 * A section is null when its source file does not exist for that month.
 * What is known to be odd about a month is in its `notes` (annotations), and
 * from when each section holds data is in `coverage`, both computed rather
 * than written down, so they do not go stale.
 */

type Json = Record<string, unknown>;

function readJson(file: string): Json | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Json;
  } catch {
    return null;
  }
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const round = (v: number) => Math.round(v * 100) / 100;

function pick(src: unknown, keys: string[]): Record<string, number | null> | null {
  if (!src || typeof src !== "object") return null;
  const o = src as Json;
  return Object.fromEntries(keys.map((k) => [k, num(o[k])]));
}

type Flow = { in: number; out: number; net: number; transactions: number };

export type OpendataMonth = {
  month: string;
  /** closed; current (still filling up); future (only calendar entries booked ahead). */
  status: "closed" | "current" | "future";
  href: string;
  /** Euro flows in and out of the Hub's accounts, from transactions.json (see OPENDATA_MONTHLY_FIELDS). */
  money: { eur: Flow; byCurrency: Record<string, Flow>; byCollective: Record<string, Flow> } | null;
  activity: Record<string, number | null> | null;
  expenses: Record<string, number | null> | null;
  invoicedIncome: Record<string, number | null> | null;
  bookings: { bookings: number; hours: number; publicBookings: number; rentalRevenue: number } | null;
  door: Record<string, number | null> | null;
  members: Record<string, number | null> | null;
  tokens: Array<Record<string, unknown>> | null;
  /** Annotations of this month (see opendata-annotations.ts). */
  notes: Array<Omit<OpendataAnnotation, "month">>;
};

/** Types that move money across the Hub's boundary; INTERNAL and TRANSFER only move it between its own accounts. */
const BOUNDARY_TYPES = new Set(["CREDIT", "DEBIT", "MINT", "BURN"]);
const EURO_RE = /^EUR/i;

const emptyFlow = (): Flow => ({ in: 0, out: 0, net: 0, transactions: 0 });

function addFlow(flow: Flow, amount: number) {
  if (amount >= 0) flow.in += amount;
  else flow.out -= amount;
  flow.net += amount;
  flow.transactions++;
}

function roundFlow(flow: Flow): Flow {
  return { in: round(flow.in), out: round(flow.out), net: round(flow.net), transactions: flow.transactions };
}

/** transactions.json is the one big file per month: summarise it once per version of the file. */
const moneyCache = new Map<string, { mtimeMs: number; money: OpendataMonth["money"] }>();

function monthMoney(file: string): OpendataMonth["money"] {
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(file).mtimeMs;
  } catch {
    return null;
  }
  const cached = moneyCache.get(file);
  if (cached && cached.mtimeMs === mtimeMs) return cached.money;

  const data = readJson(file);
  let money: OpendataMonth["money"] = null;
  if (data && Array.isArray(data.transactions)) {
    const eur = emptyFlow();
    const byCurrency: Record<string, Flow> = {};
    const byCollective: Record<string, Flow> = {};
    for (const tx of data.transactions as Json[]) {
      const currency = typeof tx.currency === "string" ? tx.currency : "";
      if (!EURO_RE.test(currency) || !BOUNDARY_TYPES.has(String(tx.type))) continue;
      const amount = num(tx.normalizedAmount) ?? num(tx.amount);
      if (amount === null) continue;
      const collective = String((tx.metadata as Json | undefined)?.collective ?? "unknown");
      addFlow(eur, amount);
      addFlow((byCurrency[currency] ??= emptyFlow()), amount);
      addFlow((byCollective[collective] ??= emptyFlow()), amount);
    }
    const roundAll = (m: Record<string, Flow>) => Object.fromEntries(Object.entries(m).map(([k, f]) => [k, roundFlow(f)]));
    money = { eur: roundFlow(eur), byCurrency: roundAll(byCurrency), byCollective: roundAll(byCollective) };
  }
  moneyCache.set(file, { mtimeMs, money });
  return money;
}

function monthRow(year: string, month: string, baseUrl: string, now: string, annotations: OpendataAnnotation[]): OpendataMonth {
  const dir = tierDir("public", year, month);
  const summary = readJson(path.join(dir, "summary.json"));
  const expenses = readJson(path.join(dir, "expenses.json"));
  const customers = readJson(path.join(dir, "customers.json"));
  const bookings = readJson(path.join(dir, "bookings.json"));
  const door = readJson(path.join(dir, "door.json"));
  const members = readJson(path.join(dir, "members.json"));

  const rooms = Array.isArray(bookings?.rooms) ? (bookings!.rooms as Json[]) : null;
  const sum = (key: string) => round((rooms ?? []).reduce((s, r) => s + (num(r[key]) ?? 0), 0));

  const tokens = Array.isArray(summary?.tokens)
    ? (summary!.tokens as Json[]).map((t) => ({
        symbol: t.symbol,
        chain: t.chain,
        minted: num(t.minted),
        burnt: num(t.burnt),
        totalSupply: num(t.totalSupply),
        tokenHolders: num(t.tokenHolders),
        activeTokenHolders: num(t.activeTokenHolders),
        transactions: num(t.transactions),
      }))
    : null;

  return {
    month: `${year}-${month}`,
    status: `${year}-${month}` < now ? "closed" : `${year}-${month}` === now ? "current" : "future",
    href: `${baseUrl}/opendata/${year}/${month}`,
    money: monthMoney(path.join(dir, "transactions.json")),
    activity: pick(summary?.summary, ["transactions", "events", "bookings", "contributors", "images"]),
    expenses: pick(expenses?.totals, ["count", "untaxedAmount", "totalAmount", "paidAmount", "amountDue"]),
    invoicedIncome: pick(customers?.totals, ["count", "untaxedAmount", "totalAmount", "paidAmount", "amountDue"]),
    bookings: rooms
      ? { bookings: sum("bookings"), hours: sum("hours"), publicBookings: sum("publicBookings"), rentalRevenue: sum("rentalRevenue") }
      : null,
    door: pick(door, ["openers", "openDays", "tokenOpens", "totalOpens"]),
    members: pick((members?.summary as Json | undefined) ?? null, ["totalMembers", "activeMembers", "monthlyMembers", "yearlyMembers"]),
    tokens,
    notes: annotations.filter((a) => a.month === `${year}-${month}`).map(({ month: _, ...rest }) => rest),
  };
}

/** Every month with a public tier, oldest first; only `year` when given. */
export function buildOpendataMonthly(baseUrl: string, year?: string, now = new Date()): OpendataMonth[] {
  const current = now.toISOString().slice(0, 7);
  const annotations = loadOpendataAnnotations();
  return listOpendataPeriods()
    .filter((p) => !year || p.year === year)
    .flatMap((p) => p.months.map((m) => monthRow(p.year, m, baseUrl, current, annotations)));
}

/** The measures coverage is computed on: a month "has data" for a section when its measure is above 0. */
const COVERAGE_MEASURES: Record<string, (m: OpendataMonth) => number | null | undefined> = {
  money: (m) => m.money?.eur.transactions,
  expenses: (m) => m.expenses?.count,
  invoicedIncome: (m) => m.invoicedIncome?.count,
  "bookings (bookings.json)": (m) => m.bookings?.bookings,
  "room calendar entries (activity.bookings)": (m) => m.activity?.bookings,
  "events (activity.events)": (m) => m.activity?.events,
  "contributors (activity.contributors)": (m) => m.activity?.contributors,
  door: (m) => m.door?.totalOpens,
  members: (m) => m.members?.totalMembers,
  "tokens (CHT)": (m) => (m.tokens?.find((t) => t.symbol === "CHT") ? 1 : 0),
};

export type OpendataCoverage = {
  /** First month with data, or null if no month has any. */
  first: string | null;
  /** Every closed month from this one on has data: before it, a 0 may mean "not recorded". Null if the last closed month has none. */
  everyMonthSince: string | null;
  /** Closed months from `first` on without data. */
  emptyMonths: number;
};

/**
 * From when each section holds data, over closed months: the current one is
 * still filling up, future ones only hold calendar entries.
 */
export function opendataCoverage(months: OpendataMonth[]): Record<string, OpendataCoverage> {
  const past = months.filter((m) => m.status === "closed");
  return Object.fromEntries(
    Object.entries(COVERAGE_MEASURES).map(([section, measure]) => {
      const has = past.map((m) => (measure(m) ?? 0) > 0);
      const firstIndex = has.indexOf(true);
      let since = has.length;
      while (since > 0 && has[since - 1]) since--;
      return [
        section,
        {
          first: firstIndex === -1 ? null : past[firstIndex].month,
          everyMonthSince: since < has.length ? past[since].month : null,
          emptyMonths: firstIndex === -1 ? 0 : has.slice(firstIndex).filter((h) => !h).length,
        },
      ];
    })
  );
}

/** What the rows contain, served next to them so the file explains itself. */
export const OPENDATA_MONTHLY_FIELDS: Record<string, string> = {
  status: "closed, current (still filling up) or future (months ahead only hold room-calendar entries booked in advance).",
  money:
    "transactions.json, euro-denominated only (EUR, EURe, EURb): in, out and net per month, also per currency and per collective. Counts CREDIT, DEBIT, MINT and BURN rows; INTERNAL and TRANSFER rows (moves between the Hub's own accounts) are left out. Stripe amounts are net of fees. The Hub is fiscal host for other collectives: filter byCollective.commonshub for the Hub alone. Prefer this over summary.json amounts (see the skill's upstream issues).",
  activity:
    "summary.json counts: transactions, events, entries in the room calendars (bookings), Discord contributors, photos. events counts only events published on the public calendar; many gatherings are not on it, so a low count does not mean little happened.",
  expenses:
    "expenses.json totals: vendor bills, credit notes and expense claims (EUR, VAT included in totalAmount), dated that month (accrual, not cash). Credit notes subtract, so a month can be negative.",
  invoicedIncome:
    "customers.json totals: invoiced income only (card payments without invoice are not included), dated that month. Credit notes and refunds subtract, so a month, or an income type in customers.json, can be negative: a correction, not negative revenue.",
  bookings:
    "bookings.json, summed over rooms: bookings, hours, public bookings, room-rental revenue (untaxed). Occupancy recorded this way only recently: see coverage, and use activity.bookings for earlier months without comparing the two.",
  door: "door.json: distinct openers, days with openings, openings.",
  members: "members.json summary counts. Membership income is in transactions.json (category membership) and customers.json.",
  tokens: "summary.json tokens: minted, burnt, supply and holders of community tokens.",
  notes: "Annotations of the month (also /opendata/annotations.json): kind incident (real, distorts totals), test (not real activity: exclude) or method (recording changed).",
  coverage:
    "Per section: first month with data, everyMonthSince (before it a 0 may mean \"not recorded\", not \"none\") and emptyMonths. Computed from the data.",
};
