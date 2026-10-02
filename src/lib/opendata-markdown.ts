import * as fs from "fs";
import * as path from "path";
import { tierDir } from "./data-paths";
import { annotationsFor, loadOpendataAnnotations } from "./opendata-annotations";
import { buildOpendataMonthly, opendataCoverage, type OpendataMonth } from "./opendata-monthly";

/**
 * Markdown versions of /finance, /economy and /community for agents
 * (/finance.md, /economy.md, /community.md): the last twelve months from the
 * open-data monthly series, and where to get the rest. Notes come from the
 * annotations and the coverage of the months shown, never written by hand.
 */

const MONTHS_SHOWN = 12;

const eur = (v: number | null | undefined) =>
  typeof v === "number" ? `${v < 0 ? "-" : ""}€${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "–";
const label = (m: OpendataMonth) => (m.status === "current" ? `${m.month} (so far)` : m.month);
const n = (v: number | null | undefined) => (typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "–");

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return "No data published yet.";
  return [`| ${headers.join(" | ")} |`, `|${headers.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

function recentMonths(baseUrl: string): { months: OpendataMonth[]; all: OpendataMonth[] } {
  const all = buildOpendataMonthly(baseUrl);
  const months = all
    .filter((m) => m.status !== "future")
    .slice(-MONTHS_SHOWN)
    .reverse();
  return { months, all };
}

/** The annotations of the months shown, for the given sections. */
function notes(months: OpendataMonth[], sections: string[]): string {
  const list = loadOpendataAnnotations();
  const shown = months.map((m) => m.month);
  const lines = sections
    .flatMap((section) => annotationsFor(list, shown, section))
    .sort((a, b) => b.month.localeCompare(a.month))
    .map((a) => `- **${a.month}**: ${a.note}`);
  return lines.length ? `\n## Notes\n\n${lines.join("\n")}\n` : "";
}

/**
 * "Recorded from …" for the sections whose data starts within the months
 * shown. Only for sections where a 0 before that means "not recorded", not
 * for sparse ones like events.
 */
function coverageNotes(all: OpendataMonth[], months: OpendataMonth[], sections: Record<string, string>): string {
  const coverage = opendataCoverage(all);
  const oldestShown = months[months.length - 1]?.month ?? "";
  const lines = Object.entries(sections).flatMap(([section, label]) => {
    const since = coverage[section]?.everyMonthSince;
    if (!coverage[section]) return [];
    if (!since) return [`${label}: not recorded, a 0 means "no data".`];
    return since > oldestShown ? [`${label}: recorded from ${since}; earlier zeros mean "not recorded".`] : [];
  });
  return lines.join(" ");
}

function footer(baseUrl: string, page: string): string {
  return `## More data

- Human view: ${baseUrl}/${page}
- Every month since the start, one request: ${baseUrl}/opendata/monthly.json (or \`/opendata/{YYYY}/monthly.json\`)
- Line-by-line files, field reference, privacy rules and caveats: ${baseUrl}/opendata
- Licence: Open Database License (ODbL) v1.0. Contains data from Commons Hub Brussels, available under the ODbL: ${baseUrl}/opendata
`;
}

function pendingBills(): { count?: number; amountDue?: number } | null {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(tierDir("public"), "pending-bills.json"), "utf8"));
    return data?.totals ?? null;
  } catch {
    return null;
  }
}

export function financeMarkdown(baseUrl: string): string {
  const { months } = recentMonths(baseUrl);
  const hub = (m: OpendataMonth) => m.money?.byCollective.commonshub;
  const bills = pendingBills();
  return `# Commons Hub Brussels — finances

> All community funds are managed transparently. Every euro in and out of the Hub's accounts (KBC bank, Stripe, EURe on Gnosis) is published as open data.

The Hub is also fiscal host for other collectives; their money flows through the same accounts. "Hub" columns are the Hub's own (collective \`commonshub\`), "All" includes the hosted collectives. Amounts are euros (EUR, EURe, EURb), transfers between the Hub's own accounts are left out, Stripe is net of fees.

## Last ${months.length} months

${table(
  ["month", "Hub in", "Hub out", "Hub net", "All in", "All out", "bills (incl. VAT)", "invoiced income"],
  months.map((m) => [
    label(m),
    eur(hub(m)?.in),
    eur(hub(m)?.out),
    eur(hub(m)?.net),
    eur(m.money?.eur.in),
    eur(m.money?.eur.out),
    eur(m.expenses?.totalAmount),
    eur(m.invoicedIncome?.totalAmount),
  ])
)}

"bills" are vendor bills dated that month (\`expenses.json\`), "invoiced income" is invoices dated that month (\`customers.json\`); both are accrual figures, unlike the cash flows. Credit notes subtract, so a month's bills can be negative.
${notes(months, ["money", "expenses", "invoicedIncome"])}${bills ? `\n## Bills still to pay\n\n${n(bills.count)} bills, ${eur(bills.amountDue)} due. List: ${baseUrl}/opendata/latest/pending-bills.json — to help, donate at ${baseUrl}/donate with the bill number as reference.\n` : ""}
${footer(baseUrl, "finance")}`;
}

export function economyMarkdown(baseUrl: string): string {
  const { months } = recentMonths(baseUrl);
  const cht = (m: OpendataMonth) => m.tokens?.find((t) => t.symbol === "CHT") as Record<string, number | null> | undefined;
  return `# Commons Hub Brussels — economy

> A new economic model to sustain our community with the Commons Hub Token.

The Commons Hub Token (CHT, on Celo) is brought into existence when a member of the community contributes time, energy and care: a steward role earns a recurring amount, and so do organised shifts and other contributions. Tokens are redeemed for the community's resources, such as booking a room (CHT per hour: ${baseUrl}/rooms.md). Euros are tracked separately: see ${baseUrl}/finance.md.

## CHT, last ${months.length} months

${table(
  ["month", "minted", "burnt", "supply at month end", "holders", "active holders"],
  months.map((m) => {
    const t = cht(m);
    return [label(m), n(t?.minted), n(t?.burnt), n(t?.totalSupply), n(t?.tokenHolders), n(t?.activeTokenHolders)];
  })
)}

${notes(months, ["tokens"])}
${footer(baseUrl, "economy")}`;
}

export function communityMarkdown(baseUrl: string): string {
  const { months, all } = recentMonths(baseUrl);
  const coverage = coverageNotes(all, months, {
    "contributors (activity.contributors)": "Contributors",
    door: "Door openings",
  });
  return `# Commons Hub Brussels — community

> A common space for communities to meet, dream and work.

Counts only: the open data never names private individuals.

## Last ${months.length} months

${table(
  ["month", "contributors (Discord)", "photos", "public events", "room calendar entries", "door openers", "open days"],
  months.map((m) => [
    label(m),
    n(m.activity?.contributors),
    n(m.activity?.images),
    n(m.activity?.events),
    n(m.activity?.bookings),
    n(m.door?.openers),
    n(m.door?.openDays),
  ])
)}

"events" counts events published on the public calendar only; many community gatherings are not on it.${coverage ? ` ${coverage}` : ""} Upcoming events: ${baseUrl}/events.md. Rooms: ${baseUrl}/rooms.md.
${notes(months, ["activity", "door"])}
${footer(baseUrl, "community")}`;
}
