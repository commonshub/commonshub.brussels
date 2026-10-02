import * as fs from "fs";
import * as path from "path";
import { tierDir, tierFor } from "./data-paths";

export type Quarter = 1 | 2 | 3 | 4;

export type OdooRowType = "invoice" | "bill";
export type OdooRowDirection = "positive" | "refund";

export interface OdooRow {
  id: string;
  type: OdooRowType;
  direction: OdooRowDirection;
  date: string;
  reference: string | null;
  month: string;
  partnerKey: string;
  partnerLabel: string;
  partnerIsCompany: boolean;
  category: string;
  untaxedAmount: number;
  vatAmount: number;
  totalAmount: number;
  status: string;
}

export interface QuarterlyTotals {
  invoicedTotal: number;
  invoicedUntaxed: number;
  vatCollected: number;
  billsTotal: number;
  billsUntaxed: number;
  vatDeductible: number;
  vatNet: number;
  invoiceCount: number;
  billCount: number;
}

export interface PartnerAggregate {
  key: string;
  label: string;
  isCompany: boolean;
  count: number;
  total: number;
}

export interface QuarterlyData {
  year: string;
  quarter: Quarter;
  months: string[];
  totals: QuarterlyTotals;
  topCustomers: PartnerAggregate[];
  topVendors: PartnerAggregate[];
  rows: OdooRow[];
  redacted: boolean;
  missingMonths: string[];
}

export function getQuarterMonths(quarter: Quarter): string[] {
  const start = (quarter - 1) * 3;
  return [start + 1, start + 2, start + 3].map((n) => n.toString().padStart(2, "0"));
}

export function parseQuarter(segment: string): Quarter | null {
  const match = /^Q([1-4])$/.exec(segment);
  if (!match) return null;
  return parseInt(match[1], 10) as Quarter;
}

type PartyType = "organisation" | "sole_trader" | "individual";

interface Party {
  id?: string;
  type?: PartyType;
  name?: string;
}

/** One entry of chb's `expenses.json` (docs/accounting-data.md). */
interface ChbExpense {
  id: string;
  number?: string;
  kind: "bill" | "credit_note" | "expense";
  status: string;
  date: string;
  vendor?: Party;
  vendorRef?: string;
  category?: string | null;
  untaxedAmount?: number;
  vatAmount?: number;
  currency?: string;
  totalAmount?: number;
  totalAmountEUR?: number;
}

/** One row of chb's `customers.json`: a customer's invoices that month. */
interface ChbCustomer {
  customer?: Party & { member?: boolean };
  individuals?: number;
  incomeType?: string;
  invoices?: number;
  untaxedAmount?: number;
  totalAmount?: number;
  amountDue?: number;
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch (error) {
    console.error(`[odoo-quarter] Failed to parse ${filePath}:`, error);
    return null;
  }
}

const INCOME_TYPES: Record<string, string> = {
  membership: "Membership",
  room_rental: "Room rental",
  tickets_events: "Tickets and events",
  sponsorship: "Sponsorship",
  donation: "Donation",
  reinvoiced_costs: "Re-invoiced costs",
  sales_services: "Services",
  other_income: "Other income",
  other: "Other",
};

const named = (party: Party | undefined) => !!party?.name;
const isCompany = (party: Party | undefined) => party?.type === "organisation" || party?.type === "sole_trader";
const round2 = (n: number) => Math.round(n * 100) / 100;

/** A vendor bill, credit note or expense claim, one row per document. Credit notes subtract. */
function billRow(expense: ChbExpense, month: string): OdooRow {
  const refund = expense.kind === "credit_note";
  const sign = refund ? -1 : 1;
  // Amounts are in the document's currency; chb gives the total in euros,
  // so untaxed and VAT are converted at the same rate.
  const original = Math.abs(expense.totalAmount ?? 0);
  const total = Math.abs(expense.totalAmountEUR ?? original);
  const rate = original > 0 ? total / original : 1;
  const untaxed = round2(Math.abs(expense.untaxedAmount ?? 0) * rate);
  const vat = round2(Math.abs(expense.vatAmount ?? 0) * rate);
  const vendor = expense.vendor;
  return {
    id: expense.id,
    type: "bill",
    direction: refund ? "refund" : "positive",
    date: expense.date,
    reference: expense.number || expense.vendorRef || (expense.kind === "expense" ? "Expense claim" : null),
    month,
    partnerKey: named(vendor) ? `vendor:${vendor!.id ?? vendor!.name}` : expense.kind === "expense" ? "bucket:expense-claims" : "bucket:individual-supplier",
    partnerLabel: named(vendor) ? vendor!.name! : expense.kind === "expense" ? "Expense claim" : "Individual supplier",
    partnerIsCompany: isCompany(vendor),
    category: expense.category || "—",
    untaxedAmount: untaxed * sign,
    vatAmount: vat * sign,
    totalAmount: total * sign,
    status: expense.status,
  };
}

/**
 * Invoiced income: chb publishes it per customer and month (the invoice
 * list is stewards-only), so one row per customer per month. Customers
 * that are not organisations are merged per income type below members.
 */
function customerRow(row: ChbCustomer, index: number, month: string, year: string): OdooRow {
  const customer = row.customer;
  const incomeType = row.incomeType ?? "other";
  const total = row.totalAmount ?? 0;
  const untaxed = row.untaxedAmount ?? 0;
  const due = row.amountDue ?? 0;
  const label = named(customer)
    ? customer!.name!
    : `Individual clients${row.individuals ? ` (${row.individuals})` : ""}`;
  return {
    id: `${month}-${customer?.id ?? `${incomeType}-${index}`}`,
    type: "invoice",
    direction: total < 0 ? "refund" : "positive",
    date: `${year}-${month}-01`,
    reference: row.invoices ? `${row.invoices} invoice${row.invoices === 1 ? "" : "s"}` : null,
    month,
    partnerKey: named(customer) ? `customer:${customer!.id ?? customer!.name}` : "bucket:individual-client",
    partnerLabel: label,
    partnerIsCompany: isCompany(customer),
    category: INCOME_TYPES[incomeType] ?? incomeType,
    untaxedAmount: untaxed,
    vatAmount: round2(total - untaxed),
    totalAmount: total,
    status: due <= 0.005 ? "paid" : due < total ? "partially_paid" : "pending",
  };
}

export function loadQuarterlyOdoo(
  year: string,
  quarter: Quarter,
  options: { showPii: boolean },
): QuarterlyData {
  const months = getQuarterMonths(quarter);
  const rows: OdooRow[] = [];
  const missingMonths: string[] = [];

  for (const month of months) {
    // chb writes expenses.json and customers.json for every month, in every
    // tier (docs/website.md §2): public names organisations only, members
    // everyone. One tier per viewer.
    const monthRoot = tierDir(tierFor(options.showPii), year, month);
    const expenses = readJson<{ expenses: ChbExpense[] }>(path.join(monthRoot, "expenses.json"));
    const customers = readJson<{ customers: ChbCustomer[] }>(path.join(monthRoot, "customers.json"));
    if (!expenses || !customers) {
      missingMonths.push(month);
      continue;
    }
    for (const expense of expenses.expenses) {
      // Reversed bills are cancelled by a credit note; chb leaves them out of its totals too.
      if (expense.status === "reversed") continue;
      rows.push(billRow(expense, month));
    }
    customers.customers.forEach((row, i) => rows.push(customerRow(row, i, month, year)));
  }

  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const invoices = rows.filter((r) => r.type === "invoice");
  const bills = rows.filter((r) => r.type === "bill");
  const sum = (list: OdooRow[], key: "totalAmount" | "untaxedAmount" | "vatAmount") => round2(list.reduce((s, r) => s + r[key], 0));

  const totals: QuarterlyTotals = {
    invoicedTotal: sum(invoices, "totalAmount"),
    invoicedUntaxed: sum(invoices, "untaxedAmount"),
    vatCollected: sum(invoices, "vatAmount"),
    billsTotal: sum(bills, "totalAmount"),
    billsUntaxed: sum(bills, "untaxedAmount"),
    vatDeductible: sum(bills, "vatAmount"),
    vatNet: 0,
    invoiceCount: invoices.length,
    billCount: bills.length,
  };
  totals.vatNet = round2(totals.vatCollected - totals.vatDeductible);

  return {
    year,
    quarter,
    months,
    totals,
    topCustomers: aggregateByPartner(invoices).slice(0, 10),
    topVendors: aggregateByPartner(bills).slice(0, 10),
    rows,
    redacted: !options.showPii,
    missingMonths,
  };
}

function aggregateByPartner(rows: OdooRow[]): PartnerAggregate[] {
  const map = new Map<string, PartnerAggregate>();
  for (const row of rows) {
    const existing = map.get(row.partnerKey);
    if (existing) {
      existing.count += 1;
      existing.total += row.totalAmount;
    } else {
      map.set(row.partnerKey, {
        key: row.partnerKey,
        label: row.partnerLabel,
        isCompany: row.partnerIsCompany,
        count: 1,
        total: row.totalAmount,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
