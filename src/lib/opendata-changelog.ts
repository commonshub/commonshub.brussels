/**
 * What changed in the open dataset, newest first: new files, changed fields,
 * removals, fixes. Served at /opendata/changelog (HTML), /opendata/changelog.md,
 * /opendata/changelog.json and /opendata/changelog.xml (Atom).
 *
 * Add an entry whenever a published file or field appears, changes meaning,
 * moves or disappears (a chb release or a website change). Mark `breaking`
 * when an existing reader has to change.
 */
export type ChangeKind = "added" | "changed" | "removed" | "fixed";

export interface ChangelogEntry {
  /** Stable slug, used as the anchor and the feed id. */
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  kind: ChangeKind;
  breaking?: boolean;
  /** Markdown; `{api}` is replaced by the open-data base URL. */
  body: string;
  /** Where it comes from: a chb release and/or a website pull request. */
  source?: { chb?: string; site?: number };
}

export const OPENDATA_CHANGELOG: ChangelogEntry[] = [
  {
    id: "members-annotations",
    date: "2026-10-03",
    title: "Members' annotations count",
    kind: "added",
    body: `Annotations signed by a member's browser key now count when the website attests that key (kind 31926) with
the \`member\` or \`steward\` role for the Commons Hub Discord server. Removing the role or the key from the
attestation revokes it at the next hourly pull. Members reclassify transactions from the year and month
reports: every category opens its transactions.`,
    source: { chb: "3.25.0", site: 108 },
  },
  {
    id: "categories-from-the-books",
    date: "2026-10-03",
    title: "Categories from the books, a published taxonomy, and coverage",
    kind: "added",
    body: `- Transactions left uncategorised by rules take their category from how the bank line is booked in Odoo
  (the invoice, bill, journal entry or account it is reconciled with): \`metadata.categorySource: "odoo"\`, and
  the matched documents' URIs in \`metadata.documents\`. Bills settling an invoice accrued the year before get
  \`accrual\` ("Previous-year invoices").
- VAT payments, local taxes, salaries and outgoing refunds are categorised by their reference while Odoo has
  not reconciled them.
- The taxonomy (slug, label, direction, group, PCMN accounts) is at \`{api}/latest/categories.json\`.
- Each month's \`summary.json\` reports \`coverage\` (\`uncategorisedShare\`, 0–1). For 2025, uncategorised money fell
  from about €116k in / €185k out to €6k / €1k.
- A bank journal's opening-balance row is no longer counted as income (\`opening_balance\`, type \`INTERNAL\`).`,
    source: { chb: "3.24.0, 3.24.1, 3.24.2" },
  },
  {
    id: "role-accounts-private",
    date: "2026-10-03",
    title: "Role accounts are private in the ledger",
    kind: "changed",
    body: `Accounts named after a role that one person holds (e.g. "Current account director", "C/C gérant") are now
treated like accounts named after a person: in \`accounts-chart.json\` they are labelled "Account of an
individual" (\`individual: true\`) and in \`ledger-balances.json\` they are merged into their group's
"individuals" row. Totals are unchanged.`,
    source: { chb: "3.23.0" },
  },
  {
    id: "chart-of-accounts",
    date: "2026-10-03",
    title: "Chart of accounts and ledger balances",
    kind: "added",
    body: `- \`{api}/latest/accounts-chart.json\`: the full chart of accounts used in Odoo (Belgian PCMN), with labels in
  English, French and Dutch, class and group; \`used\` marks the accounts with entries.
- \`{api}/{YYYY}/ledger-balances.json\`: for every account, the opening balance, debit, credit and closing
  balance of posted entries that year, refreshed hourly from Odoo.
- Accounts named after a person (current accounts, a person's fees) are merged per group with a neutral
  label, and payroll is a single line, so no individual amount can be read. Totals are exact and identical
  for every audience.`,
    source: { chb: "3.22.0" },
  },
  {
    id: "annual-accounts",
    date: "2026-10-03",
    title: "Annual accounts filed with the National Bank",
    kind: "added",
    body: `New file \`annual-accounts.json\` per year (under the year the fiscal period **ends**) and in \`/latest/\`
(every fiscal year): period, filing status, NBB register status, key figures and every figure by NBB code, the
filed abbreviated balance sheet and profit and loss as PDF (\`{api}/2025/annual-accounts/…\`, with sha256), and
consistency checks. Published: fiscal year 2025, and fiscal year "2023" (1 July 2023 – 31 December 2024) under
\`/2024/\` with class totals only (\`figuresSource: "internal-balance"\`). **Read \`checks[]\` before using the
figures**: both years have known inconsistencies under review.`,
    source: { chb: "3.20.0, 3.21.0", site: 102 },
  },
  {
    id: "odoo-uris",
    date: "2026-10-03",
    title: "One identifier per accounting document: its Odoo URI",
    kind: "changed",
    breaking: true,
    body: `Every bill, credit note, invoice and expense claim is identified everywhere by
\`odoo:<host>:<db>:<model>:<id>\` (\`account.move\`, or \`hr.expense\` for a claim not booked yet):
- new \`uri\` on every entry of \`expenses.json\` and \`pending-bills.json\`, and on \`bookings.json\` \`rentals[]\`;
- \`customers.json\`: \`invoices\` is now the **list of invoice URIs**; the count moved to \`invoiceCount\` (breaking);
- \`id\` (\`b-…\`, \`x-…\`) is deprecated and will be removed in a later chb release: use \`uri\`.`,
    source: { chb: "3.18.0" },
  },
  {
    id: "trusted-annotations",
    date: "2026-10-03",
    title: "Community annotations reach the published files",
    kind: "changed",
    body: `Tags published on Nostr (kind 1111 with a lowercase \`i\`: \`category\`, \`collective\`, \`event\`, \`spread\`,
description) are applied by chb at the next hourly run to \`transactions.json\` (description in
\`metadata.note\`), \`expenses.json\`, \`pending-bills.json\` and room rentals, when the author is trusted: the
website's key, chb's key, or anyone they follow. Comments (uppercase \`I\`) are never applied. How to annotate:
the *Contribute back* section of the skill. This removes the "Nostr tags do not reach the published files"
known bug.`,
    source: { chb: "3.18.0, 3.19.0", site: 97 },
  },
  {
    id: "opendata-html",
    date: "2026-10-03",
    title: "The skill is now at /opendata.md; /opendata is a web page",
    kind: "changed",
    body: `\`{api}\` is now the same documentation rendered as HTML. Agents load the markdown skill from
\`{base}/opendata.md\` (also still at \`{api}/SKILL.md\`). The JSON API under \`{api}/…\` is unchanged.`,
    source: { site: 99 },
  },
  {
    id: "monthly-and-annotations",
    date: "2026-10-03",
    title: "Monthly time series, data annotations and summaries",
    kind: "added",
    body: `- \`{api}/monthly.json\` and \`{api}/{YYYY}/monthly.json\`: one row per month (money in/out without internal
  transfers, expenses, invoiced income, bookings, events, door, members, tokens) and \`coverage\` per section.
- \`{api}/annotations.json\`: known one-off events in the data (test mints, incidents, changes of method) and
  known bugs at the source, also attached to the monthly rows as \`notes[]\`.
- \`{base}/finance.md\`, \`{base}/economy.md\`, \`{base}/community.md\`: the last twelve months as markdown.
- \`{base}/DATA.md\` now redirects to the open data; \`/data/\` and \`/api/\` are internal to the website.`,
    source: { site: 96 },
  },
  {
    id: "complete-file-set",
    date: "2026-10-02",
    title: "Every month and every year has every file",
    kind: "changed",
    body: `From the first month of data to the last, every month has every month file and every year every year
file, older months included; a period with nothing to report has the file with empty lists
(\`"expenses": []\`). A 404 now only means the period is not generated yet, or the path is not part of the open
dataset.`,
    source: { chb: "3.17.0" },
  },
  {
    id: "odbl",
    date: "2026-10-02",
    title: "Licensed under the Open Database License (ODbL 1.0)",
    kind: "added",
    body: `\`license\` in \`index.json\` and a \`Link: <…>; rel="license"\` header on every response. Attribution and
share-alike apply to derived databases; see the *Licence* section of the skill.`,
    source: { site: 94 },
  },
  {
    id: "accounting-files",
    date: "2026-10-02",
    title: "Expenses, vendors, customers and bookings; month bills.json removed",
    kind: "added",
    breaking: true,
    body: `New per month and per year: \`expenses.json\` (every bill, credit note and expense claim, line by line),
\`vendors.json\`, \`customers.json\` and \`bookings.json\` (room occupancy and rental revenue). Organisations
are named; private individuals appear by type only. The month \`bills.json\` is **removed**: read
\`expenses.json\`. Privacy fix: public \`transactions.json\` no longer carries bank narrations (payer names,
account numbers).`,
    source: { chb: "3.16.0" },
  },
  {
    id: "launch",
    date: "2026-10-02",
    title: "Open-data API and skill",
    kind: "added",
    body: `The public tier of the chb dataset as a read-only JSON API at \`{api}\`, with a skill for agents. Included
from the start: transactions, summaries, events, door and membership counts, \`vat.json\` (quarterly VAT
returns), \`pending-bills.json\` (bills still to pay) and \`hashes.json\` (integrity manifests).`,
    source: { site: 94 },
  },
];

const fill = (text: string, baseUrl: string) => text.replaceAll("{api}", `${baseUrl}/opendata`).replaceAll("{base}", baseUrl);

const KIND_LABEL: Record<ChangeKind, string> = { added: "Added", changed: "Changed", removed: "Removed", fixed: "Fixed" };

function sourceLine(e: ChangelogEntry): string {
  const parts: string[] = [];
  if (e.source?.chb) parts.push(`chb ${e.source.chb}`);
  if (e.source?.site) parts.push(`website #${e.source.site}`);
  return parts.length ? `\n\n*Source: ${parts.join(", ")}.*` : "";
}

/** One entry as markdown (an h2 and its body). */
export function entryMarkdown(e: ChangelogEntry, baseUrl: string): string {
  return `## ${e.date} · ${e.title}\n\n**${KIND_LABEL[e.kind]}${e.breaking ? " · breaking" : ""}**\n\n${fill(e.body, baseUrl)}${sourceLine(e)}`;
}

export function changelogIntro(baseUrl: string): string {
  return `# Commons Hub Brussels open data: changelog

What changed in the open dataset (${baseUrl}/opendata), newest first. **Breaking** means an existing reader
has to change. Also as JSON (${baseUrl}/opendata/changelog.json) and as an Atom feed
(${baseUrl}/opendata/changelog.xml).`;
}

export function changelogMarkdown(baseUrl: string): string {
  return `${changelogIntro(baseUrl)}\n\n${OPENDATA_CHANGELOG.map((e) => entryMarkdown(e, baseUrl)).join("\n\n")}\n`;
}

export function changelogJson(baseUrl: string) {
  return {
    description: "What changed in the Commons Hub Brussels open dataset, newest first.",
    documentation: `${baseUrl}/opendata`,
    entries: OPENDATA_CHANGELOG.map((e) => ({ ...e, body: fill(e.body, baseUrl), url: `${baseUrl}/opendata/changelog#${e.id}` })),
  };
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function changelogAtom(baseUrl: string): string {
  const updated = `${OPENDATA_CHANGELOG[0]?.date ?? "2026-10-02"}T00:00:00Z`;
  const items = OPENDATA_CHANGELOG.map(
    (e) => `  <entry>
    <id>${baseUrl}/opendata/changelog#${e.id}</id>
    <title>${xml(`${e.breaking ? "[breaking] " : ""}${e.title}`)}</title>
    <updated>${e.date}T00:00:00Z</updated>
    <link href="${baseUrl}/opendata/changelog#${e.id}"/>
    <content type="text">${xml(fill(e.body, baseUrl) + sourceLine(e).replace(/\*/g, ""))}</content>
  </entry>`
  ).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Commons Hub Brussels open data: changelog</title>
  <id>${baseUrl}/opendata/changelog</id>
  <link href="${baseUrl}/opendata/changelog"/>
  <link rel="self" href="${baseUrl}/opendata/changelog.xml"/>
  <updated>${updated}</updated>
${items}
</feed>
`;
}
