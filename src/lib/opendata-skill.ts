import { OPENDATA_LICENSE, OPENDATA_ROOT_FILES, OPENDATA_TIER_FILES } from "./opendata";
import { OPENDATA_ANNOTATION_KINDS, OPENDATA_UPSTREAM_ISSUES, loadOpendataAnnotations } from "./opendata-annotations";
import { buildOpendataMonthly, opendataCoverage } from "./opendata-monthly";

/**
 * The open-data skill, served as markdown at /opendata.md (and
 * /opendata/SKILL.md), and rendered as HTML at /opendata. Written for an agent or a developer who has never
 * seen the dataset: what is there, how to fetch it, and what it will never
 * contain. Linked from /llms.txt. The data-quality section is generated from
 * the data and the annotations, so it does not need editing as data arrives.
 */
export function opendataSkill(baseUrl: string): string {
  const api = `${baseUrl}/opendata`;
  const catalogue = [
    ...Object.entries(OPENDATA_TIER_FILES),
    ...Object.entries(OPENDATA_ROOT_FILES),
  ]
    .map(([file, description]) => `| \`${file}\` | ${SCOPES[file] ?? ""} | ${description} |`)
    .join("\n");

  return `---
name: commonshub-opendata
description: Fetch and analyse the open data of Commons Hub Brussels (finances, expenses line by line, vendors, customers, room bookings, events, VAT returns, integrity hashes) through the public read-only JSON API at ${api}. Use when asked about the Hub's money, suppliers, room use or events, when building something on that data, or to tag, describe or comment on a transaction or a bill (signed Nostr events on the community relay). Reading needs no key. Licensed under ODbL (attribution, share-alike). GDPR-safe by construction - private individuals are never named.
---

# Commons Hub Brussels — open data

Commons Hub Brussels (Rue de la Madeleine 51, 1000 Brussels) runs its books in
the open. Every hour the \`chb\` CLI (https://github.com/CommonsHub/chb) pulls
the Hub's bank accounts, Stripe, Odoo accounting, on-chain wallets, room
calendars and event calendars, and publishes three versions of the result:
for stewards, for members, and for **everyone**. This API serves the one for
everyone.

- Base URL: \`${api}\`
- Read-only, \`GET\` only, no key, no login. CORS is open (\`*\`), so a browser app can call it directly.
- JSON unless the file says otherwise (\`.md\`, \`.csv\`, \`.ics\`, images).
- Responses are cached for 5 minutes. The data itself refreshes hourly.
- Be gentle: cache what you download, do not poll more than once every few minutes.
- Licence: [${OPENDATA_LICENSE.name}](${OPENDATA_LICENSE.url}) — see [Licence](#licence) below.
- What changed lately: ${api}/changelog (also \`.md\`, \`.json\`, and an Atom feed at \`${api}/changelog.xml\`). Check it
  when something you rely on looks different.

## Endpoints

| URL | returns |
|---|---|
| \`${baseUrl}/opendata.md\` (or \`${api}/SKILL.md\`) | this skill, as markdown; \`${api}\` is the same page in HTML |
| \`${api}/changelog\` (HTML), \`.md\`, \`.json\`, \`.xml\` (Atom) | what is new or has changed in the dataset, newest first; **breaking** changes are marked |
| \`${api}/index.json\` | every year and month that has data, with links |
| \`${api}/monthly.json\` | one row per month since the start: money in/out, expenses, invoiced income, bookings, events, door, members, tokens |
| \`${api}/{YYYY}/monthly.json\` | the same, for one year |
| \`${api}/annotations.json\` | known one-off events in the data (test mints, incidents, changes of method) and known bugs at the source |
| \`${api}/latest\` | the files of the current state: newest month and lifetime rollups |
| \`${api}/{YYYY}\` | the files of a whole year (rollups) |
| \`${api}/{YYYY}/{MM}\` | the files of one month (\`MM\` is two digits: \`2026/09\`) |
| \`${api}/{period}/{file}\` | one file, e.g. \`${api}/2026/09/expenses.json\` |
| \`${api}/{YYYY}/{MM}/events/images/{file}\` | an event cover image |

A listing answers \`{ "period": "2026/09", "files": [{ "file", "href", "bytes", "description" }] }\`.
Every month and every year that has data has **every** file of its scope, older months included:
a month with nothing to report has the file with empty lists (\`"expenses": []\`). A **404** means the
period is not generated yet, or the path is not part of the open dataset.

## Files

Scope: **M** = month (\`/{YYYY}/{MM}/\`), **Y** = year (\`/{YYYY}/\`), **L** = \`/latest/\`.

| file | scope | what |
|---|---|---|
${catalogue}

## Quick start

\`\`\`bash
# What exists?
curl -s ${api}/index.json | jq '.periods[] | {year, months: [.months[].month]}'

# The Hub's own euro cash flow, month by month (one request)
curl -s ${api}/monthly.json | jq -r '.months[] | [.month, .money.byCollective.commonshub.in, .money.byCollective.commonshub.out] | @tsv'

# Who did the Hub pay in 2026, and how much? (year rollup, largest first)
curl -s ${api}/2026/vendors.json | jq -r '.vendors[] | [(.vendor.name // "(\\(.individuals) individuals)"), .category, .totalAmount] | @tsv'

# What was bought, line by line, in September 2026?
curl -s ${api}/2026/09/expenses.json | jq -r '.expenses[] | .vendor.name as $v | .lines[] | [.product // .description, .quantity, .totalAmount, ($v // "individual")] | @tsv'

# Bills still to pay (the "help us pay" list)
curl -s ${api}/latest/pending-bills.json | jq '.totals, [.bills[] | {number, vendor: .vendor.name, amountDue, dueDate}]'

# Upcoming events
curl -s ${api}/latest/events.md
\`\`\`

\`\`\`python
import requests
API = "${api}"
idx = requests.get(f"{API}/index.json", timeout=30).json()
for y in idx["periods"]:
    for m in y["months"]:
        r = requests.get(f"{API}/{y['year']}/{m['month']}/summary.json", timeout=30)
        if r.ok:
            print(y["year"], m["month"], r.json().keys())
\`\`\`

\`\`\`js
const API = "${api}";
const { bookings, rooms } = await fetch(\`\${API}/2026/bookings.json\`).then(r => r.json());
\`\`\`

## Conventions

- **Money** is in euros unless \`currency\` says otherwise. Accounting files (\`expenses\`, \`vendors\`,
  \`customers\`, \`bookings\`) carry \`currency: "EUR"\` and convert foreign documents
  (\`totalAmountEUR\`). Credit notes and refunds subtract, so a month, a category or an income type can
  have a negative total: a correction, not negative revenue.
- **Time**: dates are \`YYYY-MM-DD\`; timestamps are RFC 3339 with an explicit offset; the Hub's
  timezone is \`Europe/Brussels\`. \`transactions[].timestamp\` is Unix seconds. All-day events have no clock time.
- Every file has \`generatedAt\`. Accounting files also have \`scope\` (\`month\` | \`year\`) and \`period\` (\`2026-09\` | \`2026\`).
- **Ids are stable**: a bill keeps the same \`id\` (\`b-…\`) in \`expenses.json\` and \`pending-bills.json\`;
  an organisation keeps the same \`vendor.id\` / \`customer.id\` (\`p-…\`) across months.
  Transaction ids are NIP-73 URIs (\`stripe:txn_…\`, \`ethereum:42220:tx:0x…\`, \`iban:…:tx:…\`).
- Accounting files are per month and per year only, never in \`/latest/\`. \`pending-bills.json\` is only in \`/latest/\`.

## The main files

### \`expenses.json\` (M, Y) — what the Hub spends, line by line

\`totals\` (count, untaxedAmount, totalAmount, paidAmount, amountDue), \`byCategory[]\`, and \`expenses[]\`:
\`id\`, \`number\` (our accounting number), \`kind\` (\`bill\` | \`credit_note\` | \`expense\` = someone reimbursed),
\`status\` (\`pending\` | \`partially_paid\` | \`paid\` | \`reversed\` | \`submitted\`), \`date\`, \`dueDate\`,
\`vendor\` (\`{ id, type, name, vat }\`, see below), \`description\`, \`category\`, \`collective\`, \`event\`,
amounts, \`hasDocument\`, and \`lines[]\` (\`description\`, \`product\`, \`quantity\`, \`unitPrice\`,
\`untaxedAmount\`, \`totalAmount\`, \`vatRate\`, \`account: { code, class }\`).
\`reversed\` documents are excluded from totals.

### \`vendors.json\` / \`customers.json\` (M, Y) — who the Hub pays, who pays the Hub

One row per vendor (\`category\`, \`documents\`, \`totalAmount\`, \`paidAmount\`, \`amountDue\`) or per customer
(\`incomeType\`: \`membership\` | \`room_rental\` | \`tickets_events\` | \`sponsorship\` | \`donation\` |
\`reinvoiced_costs\` | \`sales_services\` | \`other_income\` | \`other\`; \`products\`, \`invoices\`, \`receivedAmount\`).
Private individuals are merged into one anonymous row per category / income type with a count
(\`individuals\`). Only invoiced income is in \`customers.json\`; card payments without an invoice (most
event tickets) are in \`transactions.json\`.

### \`bookings.json\` (M, Y) — how the rooms are used

\`rooms[]\` per room: \`bookings\`, \`hours\`, \`publicBookings\`, \`rentalLines\`, \`rentalRevenue\` (untaxed).
\`bookings[]\`: \`room\`, \`start\`, \`end\`, \`hours\`, \`public\`; a \`title\` and \`eventUrl\` only when the
booking hosts a public event. \`rentals[]\`: room-rental invoice lines (\`date\` = invoice date, \`room\`,
\`product\`, amounts, \`customer\` named only when it is an organisation). Invoices and bookings are
deliberately **not** linked one to one. The year file adds \`months[]\` for charts.
Occupancy has been recorded this way only recently (see coverage below). For earlier months,
\`summary.json\` \`summary.bookings\` counts entries in the room calendars: a different measure, do not
join the two into one series.

### \`transactions.json\` (M, L) — every movement of money

\`transactions[]\`: \`id\`, \`provider\` (\`stripe\`, \`etherscan\`, \`kbcbrussels\`, …), \`accountSlug\`, \`accountName\`,
\`currency\`, \`amount\`, \`normalizedAmount\`, \`grossAmount\`, \`fee\`, \`type\` (\`CREDIT\` | \`DEBIT\`, and
\`MINT\` | \`BURN\` for community tokens), \`timestamp\`, \`event\` (when a ticket sale belongs to an event),
\`metadata.category\`, \`metadata.collective\`, \`metadata.description\` (only labels we wrote, never the
bank's narration). \`counterpartyId\` is present only when it names nobody (a blockchain address, one of
the Hub's own accounts).
A row with \`metadata.excluded\` (a reason) is listed for transparency but is not real activity: leave it out of
sums, as \`summary.json\` and \`contributors.json\` do.

### \`monthly.json\` — the time series

Computed on request from the month files. \`months[]\`, oldest first, one row per month: \`month\`
(\`YYYY-MM\`), \`status\` (\`closed\` | \`current\` | \`future\`), \`money\` (\`eur\`, \`byCurrency\`, \`byCollective\`, each \`{ in, out, net, transactions }\`),
\`activity\`, \`expenses\` and \`invoicedIncome\` (the \`totals\` of \`expenses.json\` / \`customers.json\`),
\`bookings\`, \`door\`, \`members\`, \`tokens\`. A section is \`null\` when the month has no such file.
\`fields\` explains each section. \`money\` is summed from \`transactions.json\`: euro-denominated rows
only (EUR, EURe, EURb), \`CREDIT\`/\`DEBIT\`/\`MINT\`/\`BURN\` only (moves between the Hub's own accounts are
left out), Stripe net of fees. **Prefer it over \`summary.json\` for money** (see known bugs below).
Each row has \`notes[]\` (the annotations of that month), and the file has \`coverage\`: from when each
section holds data. \`future\` months exist because room calendars are booked ahead; they hold calendar
entries only.

### \`summary.json\` (M, L) — aggregates

Per account, collective and category for a month; \`/latest/summary.json\` is the lifetime rollup per
collective (\`firstMonth\`, \`lastMonth\`, \`collectives[]\` with per-currency totals and balances).
Read the known bugs below before using its amounts or balances.

### \`events.json\` (M, Y, L), \`events.csv\` (Y), \`events.md\` (L)

\`events[]\`: \`id\`, \`name\`, \`description\`, \`startAt\`, \`endAt\`, \`allDay\`, \`location\`, \`url\`, \`coverImage\`,
\`source\`, \`tags\`, \`metadata.host\` — events exactly as their organisers published them on the public
calendar. No guest lists, no attendance, no ticket revenue. Many gatherings at the Hub are not on the
public calendar, so a low count does not mean little happened.

### \`pending-bills.json\` (L) — the "help us pay" list

Every vendor bill still open: \`totals\` (count, totalAmount, amountDue), \`bills[]\` with \`id\`, \`number\`,
\`status\`, \`date\`, \`dueDate\`, \`vendor: { type: "business" | "individual", name, vat }\`, \`lines[]\`,
\`amountDue\`. To help pay one, people donate to the Hub with the bill \`number\` as reference
(${baseUrl}/donate) — never to the vendor directly.

### \`annual-accounts.json\` (Y, L) — the accounts filed with the National Bank

One entry per fiscal year in \`fiscalYears[]\`, filed under the year its period **ends** (the first fiscal
year ran 1 July 2023 – 31 December 2024 and is labelled "2023" under \`/2024/\`): \`period\`, \`status\`,
\`filedAt\`, \`nbb\`, \`keyFigures\` (total assets 20/58, cash 54/58, equity 10/15, turnover 70, gifts and
subsidies 73, remuneration 62, result of the period 9904, …), \`figures\` (every NBB code), \`documents[]\`
(the abbreviated balance sheet and profit and loss as PDF, at \`${api}/{YYYY}/annual-accounts/{file}\`, with
sha256), and \`checks[]\`: consistency problems found in the statements (unbalanced totals, a balancing
"other appropriations" entry, an opening balance that does not follow the previous closing). **Read the
checks before using the figures**: the 2024 and 2025 accounts have known issues under review.
Schema: https://github.com/CommonsHub/chb/blob/main/docs/annual-accounts.md

### \`categories.json\` (L) — what each category means

\`${api}/latest/categories.json\` lists every category slug used in \`metadata.category\`, \`expenses.json\` and the
reports: \`slug\`, \`label\`, \`direction\` (\`income\` | \`expense\` | \`both\`), \`group\`, and \`accounts\`: the PCMN
account prefixes that map to it (the longest prefix wins). \`internal_transfer\` and \`opening_balance\` are not
income or spending: leave them out of totals. A transaction's category comes from chb's rules, then a trusted
Nostr annotation, then how the bank line is booked in Odoo (\`metadata.categorySource: "odoo"\`, with the
matched documents' URIs in \`metadata.documents\`). Each month's \`summary.json\` has \`coverage\`: euro amounts in
and out, and \`uncategorisedShare\` (0–1).

### \`accounts-chart.json\` (L) and \`ledger-balances.json\` (Y) — the books by account number

\`${api}/latest/accounts-chart.json\` is the chart of accounts the Hub uses in Odoo: the Belgian PCMN
(minimum standardised chart), about 1,100 accounts, each with \`code\` (e.g. \`610150\`), \`label\` and
\`labels\` (\`en_GB\`, \`fr_BE\`, \`nl_BE\`), \`class\` (1–7), \`group\`, Odoo \`type\` and \`reconcile\`.
\`used: true\` marks the ~150 accounts that have entries; filter on it. An account named after a person is
labelled "Account of an individual" (\`individual: true\`).

\`${api}/{YYYY}/ledger-balances.json\` is that year's trial balance by account: \`opening\`, \`debit\`,
\`credit\`, \`closing\` (debit positive, closing = opening + debit − credit) and \`totals\`. Classes 1–5 open
with everything before 1 January; classes 6–7 open at the start of the fiscal year (\`fiscalStart\`; 2024
opens on 2023-07-01). \`totals.opening\` is the result of earlier years not yet booked to equity (14).
Accounts of individuals are merged per group (\`merged: N\`, e.g. "Current accounts of individuals") and
payroll is one line \`62\`, so no individual amount can be read; the totals are exact. Join the two files
on \`code\` to get labels in your language. Refreshed hourly from Odoo: the figures move while the
accounts are being corrected (see \`annual-accounts.json\` checks).

### \`hashes.json\` (M, L) and \`vat.json\` (Y, L)

\`hashes.json\` is the integrity manifest of a month: per data source, counts and a sha256 over the raw
archives, plus hashes of the public and members trees. \`/latest/hashes.json\` indexes every month and
carries one top-level \`hash\` for the whole dataset. Use it to prove two copies are the same.
\`vat.json\` lists every quarterly VAT return filed with the Belgian State (Intervat): every grid of the
official form, control totals (\`outputVat\`, \`inputVat\`, \`net\`), and corrections (\`filings[]\`).
\`gridLabels\` names the grids.

## Contribute back: tag, describe and comment (Nostr)

The data is read-only, but anyone the community trusts can add to it: categorise a transaction,
say what a bill was for, split a cost over several months, or start a discussion. These are
signed [Nostr](https://nostr.com) events on the community relay. Nothing is written to the
website or the dataset directly.

### What you can point at

Every item has a stable identifier, in the style of
[NIP-73](https://github.com/nostr-protocol/nips/blob/master/73.md) (external content ids):

| item | identifier | where to find it | \`k\` |
|---|---|---|---|
| a transaction | its \`id\`: \`stripe:txn_…\`, \`ethereum:<chain id>:tx:<hash>\`, \`iban:<iban>:tx:<hash>\` | \`transactions.json\` | \`stripe:txn\`, \`ethereum:tx\`, \`iban:tx\` |
| a vendor bill, credit note or customer invoice | its Odoo URI \`odoo:<host>:<db>:account.move:<id>\` | \`uri\` in \`expenses.json\` / \`pending-bills.json\`, \`invoices[]\` in \`customers.json\`, \`uri\` on \`bookings.json\` rentals | \`odoo:account.move\` |
| an expense claim (someone reimbursed) | \`odoo:<host>:<db>:hr.expense:<id>\` | \`uri\` in \`expenses.json\` (\`kind: "expense"\`) | \`odoo:hr.expense\` |
| a recurring cost (rent, furniture, …) | \`chb:expense:<slug>\`, e.g. \`chb:expense:rent\` | the page \`${baseUrl}/expenses/<slug>\` (shown on the website; not an accounting document, so chb does not apply it) | \`chb:expense\` |

The Odoo URI is the one global identifier of an accounting document: the same in the open data, on
Nostr, on the website and in chb.

### Tag or describe an item: a kind 1111 snapshot

\`\`\`json
{
  "kind": 1111,
  "content": "Crates for the fridge, September delivery",
  "tags": [
    ["i", "odoo:commonshub.odoo.com:commonshub:account.move:45973"],
    ["k", "odoo:account.move"],
    ["category", "cold-drinks"],
    ["collective", "commonshub"],
    ["event", "open-commons-day-2026"],
    ["spread", "2026-09", "275.07"],
    ["spread", "2026-10", "275.06"],
    ["t", "app:<your app>"]
  ]
}
\`\`\`

- \`content\` is the description. Recognised tags: \`category\`, \`collective\`, \`event\`, and \`spread\`
  (\`[month, amount]\`, repeated, to spread a cost or an income over several months). Use the values
  already found in \`transactions.json\` (\`metadata.category\`, \`metadata.collective\`).
- \`["exclude", "<reason>"]\` marks a transaction as not real activity (a test mint, a duplicate): chb keeps it in
  \`transactions.json\` with \`metadata.excluded\` set to the reason and leaves it out of every total. A newer
  snapshot without the tag includes it again.
- **Each event is a full snapshot**: the newest one per identifier wins, whoever wrote it. To change
  one tag, read the current snapshot first and republish it with every tag you want to keep.
- No uppercase \`I\` tag: that is what marks a comment (below), and readers skip such events here.

Read an item's current tags: \`{"kinds":[1111],"#i":["<identifier>"]}\`, drop events that have an
uppercase \`I\`, keep the newest.

### Comment on an item: NIP-22

A top-level [NIP-22](https://github.com/nostr-protocol/nips/blob/master/22.md) comment, kind 1111,
with the identifier both as root (uppercase) and as parent (lowercase):

\`\`\`json
{
  "kind": 1111,
  "content": "This bill also covers the milk for the coffee corner.",
  "tags": [
    ["I", "odoo:commonshub.odoo.com:commonshub:account.move:45973"], ["K", "odoo:account.move"],
    ["i", "odoo:commonshub.odoo.com:commonshub:account.move:45973"], ["k", "odoo:account.move"],
    ["t", "app:<your app>"]
  ]
}
\`\`\`

Read a thread: \`{"kinds":[1111],"#I":["<identifier>"]}\`. Replies follow NIP-22 (lowercase \`e\`/\`k\`
pointing at the parent comment).

### Where to publish, and who may

- Relay: **\`wss://relay.commonshub.brussels\`**. Reading is open.
- Writing is limited to community members: the relay accepts an event when its author's key is on
  the allow-list, or is attested by an allow-listed key (kind 31926, \`p\` tag). Members' browser
  keys are attested when they sign in on ${baseUrl}.
- **An agent needs its own key.** Generate one, keep the secret safe, and send the npub with a line
  about what the agent will do to hello@commonshub.brussels (or a steward on Discord) to be
  allow-listed. A rejected event comes back from the relay with \`OK false\` and a reason.
- **Which annotations count.** Anyone the relay accepts can publish, but chb applies an annotation to
  the published data only when its author is trusted: the seeds in chb's settings (the website's key and
  chb's own), anyone a seed follows (their kind 3 contact list), and any key the website attests (kind 31926)
  with the \`member\` or \`steward\` role for the Commons Hub Discord server; one level deep. Members get this
  by signing in on ${baseUrl}. An untrusted annotation stays visible on the relay but changes nothing. To have
  an agent's annotations applied, ask to be followed.
- Sign as yourself, write for people, and do not mass-edit: every event is public, permanent and
  attributable to your key.

\`\`\`js
import { finalizeEvent } from "nostr-tools/pure"; // nostr-tools v2
import { SimplePool } from "nostr-tools/pool";
import { Relay } from "nostr-tools/relay";
import { hexToBytes } from "@noble/hashes/utils";

const RELAY = "wss://relay.commonshub.brussels";
const pool = new SimplePool();
const id = "odoo:commonshub.odoo.com:commonshub:account.move:45973"; // \`uri\` from expenses.json
// Start from the current snapshot so the tags you do not touch are kept.
const [current] = (await pool.querySync([RELAY], { kinds: [1111], "#i": [id] }))
  .filter((e) => !e.tags.some((t) => t[0] === "I"))
  .sort((a, b) => b.created_at - a.created_at);
const keep = (current?.tags ?? []).filter((t) => !["i", "k", "category"].includes(t[0]));
const event = finalizeEvent({
  kind: 1111,
  created_at: Math.floor(Date.now() / 1000),
  content: current?.content ?? "",
  tags: [["i", id], ["k", "odoo:account.move"], ["category", "cold-drinks"], ...keep],
}, hexToBytes(process.env.NOSTR_SECRET_HEX));
pool.close([RELAY]);
// Publish on a single connection: Relay.publish throws with the relay's
// reason ("blocked: not on allowlist") when the event is refused.
const relay = await Relay.connect(RELAY);
try {
  console.log("saved:", await relay.publish(event));
} finally {
  relay.close();
}
\`\`\`

### What happens next

- The website shows a tag or a comment on the item's page as soon as the relay has it.
- At its next hourly run, chb applies the newest **trusted** annotation per identifier: \`category\`,
  \`collective\`, \`event\` and \`spread\` to \`transactions.json\` (the description as \`metadata.note\`),
  \`expenses.json\`, \`pending-bills.json\` and room rentals. Comments (uppercase \`I\`) are never applied.
- The full guide, and a command-line way to annotate (\`chb nostr annotate <uri> --category …\`):
  https://github.com/CommonsHub/chb/blob/main/docs/annotations.md

## Privacy: what you will and will not find

This dataset is designed to be as transparent as possible **and** to respect the GDPR. The
filtering happens before a file is written, so the data simply is not there.

- **Organisations are named** (companies, associations, public bodies) as vendors and customers,
  with their VAT number and what they sold or bought. That is how you can follow the money.
- **Sole traders** (a person registered for VAT) are named as vendors with their VAT number,
  which is public in the Belgian company register, and the **products** they sold — but not the
  free text of their invoices, their invoice reference, or the event a bill is tagged with.
- **Private individuals are never named.** They appear only by type
  (\`{"type": "individual"}\`, sometimes \`"member": true\`), merged per category, with no id, so nobody
  can be followed from month to month.
- **No invoice links a person to an event.** Bills from individuals and sole traders lose their
  event tag and free text; room-rental invoice lines show the room and the invoice date, never who
  rented it unless it is an organisation; bookings show a title only for public events.
- **Never published**: emails, phone numbers, addresses, IBANs and BICs of third parties,
  Stripe/Odoo ids, payroll details (payroll appears as "Payroll" with an amount), bank narrations,
  attendee lists, door-opening dates, member lists, Discord profiles and photos.
- Event hosts (\`metadata.host\`) are shown as the organisers published them on the public calendar.

**Ground rules for reuse**

1. Do not try to re-identify anonymous rows, and do not join this data with other sources to
   attach a name, a date or a place to a private individual.
2. If you find personal data that should not be here, stop using it and tell
   hello@commonshub.brussels: it will be removed at the source.
3. Respect the licence (below).

## Licence

The dataset is published under the **${OPENDATA_LICENSE.name}**: ${OPENDATA_LICENSE.url}
(\`license\` in \`index.json\`, and a \`Link: <…>; rel="license"\` header on every response).

- **Attribute.** Wherever you use or show the data, credit it. For example:
  > ${OPENDATA_LICENSE.attribution}

  Keep the \`generatedAt\` of the files you used, so others can reproduce your result.
- **Share alike.** If you publicly use a database derived from this one (data you combined,
  cleaned, enriched or restructured), you must offer that derived database under the ODbL too,
  or the changes needed to rebuild it. Public use includes a public website, app or API built on it.
- **Produced works are yours.** Charts, articles, slides and apps made from the data may use any
  licence, as long as they carry the attribution notice above.
- **Keep it open.** Do not add technical restrictions (DRM) to copies you distribute without also
  offering an unrestricted copy.
- Private analysis owes nothing back. Sharing your derived data with the Hub is always welcome:
  hello@commonshub.brussels.

The ODbL covers the database. It does not lift the ground rules above: personal-data protection
(GDPR) applies to anyone who processes the data, whatever the licence.

${dataQuality(baseUrl)}
## Good to know

- Odoo is pulled hourly, but a bill stays \`pending\` until it is reconciled with its payment, so
  utilities paid by direct debit can look unpaid for a while.
- A vendor that shows as anonymous but is a company is fixed in Odoo (mark it as a company, add
  its VAT number); it reappears by name at the next hourly run.
- The schemas and the reasoning behind each field are documented in the chb repository:
  https://github.com/CommonsHub/chb/blob/main/docs/website.md and
  https://github.com/CommonsHub/chb/blob/main/docs/accounting-data.md
- Other entry points: ${baseUrl}/llms.txt (the site for agents), ${baseUrl}/events.md,
  ${baseUrl}/rooms.md, ${baseUrl}/finance.md, ${baseUrl}/economy.md, ${baseUrl}/community.md
  (month-by-month summaries), ${baseUrl}/finance (the human view of the same data).
- \`/data/\` and \`/api/\` on the website are internal and may change or require a login: use \`/opendata\`.
`;
}

const SCOPES: Record<string, string> = {
  "transactions.json": "M, L",
  "counterparties.json": "M, L",
  "summary.json": "M, L",
  "commissions.json": "M",
  "inbound_spreads.json": "M",
  "activitygrid.json": "Y, L",
  "members.json": "M, L",
  "door.json": "M, L",
  "events.json": "M, Y, L",
  "events.csv": "Y",
  "events.md": "L",
  "rooms.md": "L",
  "calendars/public.ics": "M",
  "expenses.json": "M, Y",
  "vendors.json": "M, Y",
  "customers.json": "M, Y",
  "bookings.json": "M, Y",
  "pending-bills.json": "L",
  "hashes.json": "M, L",
  "vat.json": "Y, L",
  "annual-accounts.json": "Y, L",
  "categories.json": "L",
  "accounts-chart.json": "L",
  "ledger-balances.json": "Y",
};

/**
 * Generated from the data: coverage from the monthly series, annotations from
 * chb (or the built-in list), bugs from OPENDATA_UPSTREAM_ISSUES.
 */
function dataQuality(baseUrl: string): string {
  const coverage = opendataCoverage(buildOpendataMonthly(baseUrl));
  const coverageRows = Object.entries(coverage)
    .map(([section, c]) => `| ${section} | ${c.first ?? "never"} | ${c.everyMonthSince ?? "–"} | ${c.emptyMonths} |`)
    .join("\n");
  const annotations = loadOpendataAnnotations()
    .map((a) => `- **${a.month}**, \`${a.section}\` (${a.kind}): ${a.note}`)
    .join("\n");
  const kinds = Object.entries(OPENDATA_ANNOTATION_KINDS)
    .map(([kind, meaning]) => `\`${kind}\` = ${meaning}`)
    .join("; ");
  const issues = OPENDATA_UPSTREAM_ISSUES.map(
    (i) => `- **${i.title}**${i.url ? ` (${i.url})` : ""}. ${i.detail} Workaround: ${i.workaround}`
  ).join("\n");

  return `## Data quality

The data is published as chb produces it. Work around what follows rather than reporting it as a finding.

### Coverage

From when each section of \`monthly.json\` holds data, over closed months (also \`coverage\` in that
file). Before "every month since", a 0 may mean "not recorded" rather than "none": do not chart it as
a drop. Events are sparse by nature (see \`events.json\`), so their gaps are real.

| section | first month with data | every month since | empty months since first |
|---|---|---|---|
${coverageRows}

### Annotations

One-off events in the data (${kinds}). Machine-readable at \`${baseUrl}/opendata/annotations.json\`,
and on the matching rows of \`monthly.json\` as \`notes[]\`.

${annotations || "None."}

### Known bugs at the source

${issues || "None known."}
`;
}
