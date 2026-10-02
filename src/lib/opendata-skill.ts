import { OPENDATA_ROOT_FILES, OPENDATA_TIER_FILES } from "./opendata";

/**
 * The open-data skill, served as markdown at /opendata (and
 * /opendata/SKILL.md). Written for an agent or a developer who has never
 * seen the dataset: what is there, how to fetch it, and what it will never
 * contain. Linked from /llms.txt.
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
description: Fetch and analyse the open data of Commons Hub Brussels (finances, expenses line by line, vendors, customers, room bookings, events, VAT returns, integrity hashes) through the public read-only JSON API at ${api}. Use when asked about the Hub's money, suppliers, room use or events, or when building something on that data. No key needed. GDPR-safe by construction - private individuals are never named.
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

## Endpoints

| URL | returns |
|---|---|
| \`${api}\` | this skill (markdown) |
| \`${api}/index.json\` | every year and month that has data, with links |
| \`${api}/latest\` | the files of the current state: newest month and lifetime rollups |
| \`${api}/{YYYY}\` | the files of a whole year (rollups) |
| \`${api}/{YYYY}/{MM}\` | the files of one month (\`MM\` is two digits: \`2026/09\`) |
| \`${api}/{period}/{file}\` | one file, e.g. \`${api}/2026/09/expenses.json\` |
| \`${api}/{YYYY}/{MM}/events/images/{file}\` | an event cover image |

A listing answers \`{ "period": "2026/09", "files": [{ "file", "href", "bytes", "description" }] }\`
and only shows files that exist for that period. A **404 means "nothing for that
period"** (a month without vendor bills has no \`expenses.json\`), or a path that is
not part of the open dataset.

## Files

Scope: **M** = month (\`/{YYYY}/{MM}/\`), **Y** = year (\`/{YYYY}/\`), **L** = \`/latest/\`.

| file | scope | what |
|---|---|---|
${catalogue}

## Quick start

\`\`\`bash
# What exists?
curl -s ${api}/index.json | jq '.periods[] | {year, months: [.months[].month]}'

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
  (\`totalAmountEUR\`). Credit notes subtract.
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

### \`transactions.json\` (M, L) — every movement of money

\`transactions[]\`: \`id\`, \`provider\` (\`stripe\`, \`etherscan\`, \`kbcbrussels\`, …), \`accountSlug\`, \`accountName\`,
\`currency\`, \`amount\`, \`normalizedAmount\`, \`grossAmount\`, \`fee\`, \`type\` (\`CREDIT\` | \`DEBIT\`, and
\`MINT\` | \`BURN\` for community tokens), \`timestamp\`, \`event\` (when a ticket sale belongs to an event),
\`metadata.category\`, \`metadata.collective\`, \`metadata.description\` (only labels we wrote, never the
bank's narration). \`counterpartyId\` is present only when it names nobody (a blockchain address, one of
the Hub's own accounts).

### \`summary.json\` (M, L) — aggregates

Per account, collective and category for a month; \`/latest/summary.json\` is the lifetime rollup per
collective (\`firstMonth\`, \`lastMonth\`, \`collectives[]\` with per-currency totals and balances).

### \`events.json\` (M, Y, L), \`events.csv\` (Y), \`events.md\` (L)

\`events[]\`: \`id\`, \`name\`, \`description\`, \`startAt\`, \`endAt\`, \`allDay\`, \`location\`, \`url\`, \`coverImage\`,
\`source\`, \`tags\`, \`metadata.host\` — events exactly as their organisers published them on the public
calendar. No guest lists, no attendance, no ticket revenue.

### \`pending-bills.json\` (L) — the "help us pay" list

Every vendor bill still open: \`totals\` (count, totalAmount, amountDue), \`bills[]\` with \`id\`, \`number\`,
\`status\`, \`date\`, \`dueDate\`, \`vendor: { type: "business" | "individual", name, vat }\`, \`lines[]\`,
\`amountDue\`. To help pay one, people donate to the Hub with the bill \`number\` as reference
(${baseUrl}/donate) — never to the vendor directly.

### \`hashes.json\` (M, L) and \`vat.json\` (Y, L)

\`hashes.json\` is the integrity manifest of a month: per data source, counts and a sha256 over the raw
archives, plus hashes of the public and members trees. \`/latest/hashes.json\` indexes every month and
carries one top-level \`hash\` for the whole dataset. Use it to prove two copies are the same.
\`vat.json\` lists every quarterly VAT return filed with the Belgian State (Intervat): every grid of the
official form, control totals (\`outputVat\`, \`inputVat\`, \`net\`), and corrections (\`filings[]\`).
\`gridLabels\` names the grids.

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
3. Cite "Commons Hub Brussels open data" with the link ${api} and the \`generatedAt\` of what you used.

## Good to know

- Odoo is pulled hourly, but a bill stays \`pending\` until it is reconciled with its payment, so
  utilities paid by direct debit can look unpaid for a while.
- Treat a missing file as "nothing that period", not as an error.
- A vendor that shows as anonymous but is a company is fixed in Odoo (mark it as a company, add
  its VAT number); it reappears by name at the next hourly run.
- The schemas and the reasoning behind each field are documented in the chb repository:
  https://github.com/CommonsHub/chb/blob/main/docs/website.md and
  https://github.com/CommonsHub/chb/blob/main/docs/accounting-data.md
- Other entry points: ${baseUrl}/llms.txt (the site for agents), ${baseUrl}/events.md,
  ${baseUrl}/rooms.md, ${baseUrl}/finance (the human view of the same data).
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
};
