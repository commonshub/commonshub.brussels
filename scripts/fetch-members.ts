/**
 * Fetch membership subscriptions from Stripe and Odoo
 *
 * Directory structure per month:
 *   data/{year}/{month}/
 *     stripe/subscriptions.json   ← raw Stripe snapshot (hashed emails)
 *     odoo/subscriptions.json     ← raw Odoo snapshot (hashed emails)
 *     members.json                ← merged, deduplicated, public view
 *     private/members.csv         ← full PII for admin use
 *
 * Usage:
 *   npx tsx scripts/fetch-members.ts
 *   npx tsx scripts/fetch-members.ts --backfill
 *   npx tsx scripts/fetch-members.ts --month=2026-02
 *   npx tsx scripts/fetch-members.ts --stripe-only
 *   npx tsx scripts/fetch-members.ts --odoo-only
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type { Member, MembersFile, MembersSummary, Amount } from "../src/types/members";
import settings from "../src/settings/settings.json";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const ODOO_API_KEY = process.env.ODOO_API_KEY;
const ODOO_LOGIN = process.env.ODOO_LOGIN;
const EMAIL_HASH_SALT = process.env.EMAIL_HASH_SALT;

const STRIPE_PRODUCT_ID = settings.membership.stripe.productId;
const ODOO_CONFIG = settings.membership.odoo;

// ─── Types ──────────────────────────────────────────────────────────────────

interface StripeSubscription {
  id: string;
  status: string;
  customer: string;
  current_period_start: number;
  current_period_end: number;
  created: number;
  canceled_at: number | null;
  ended_at: number | null;
  items: {
    data: Array<{
      price: {
        id: string;
        unit_amount: number;
        currency: string;
        recurring: { interval: "month" | "year"; interval_count: number };
        product: string;
      };
    }>;
  };
  metadata?: Record<string, string>;
  latest_invoice?: string | StripeInvoice;
}

interface StripeCustomer {
  id: string;
  email: string;
  name: string | null;
  metadata?: Record<string, string>;
}

interface StripeInvoice {
  id: string;
  status: string;
  amount_paid: number;
  currency: string;
  created: number;
  hosted_invoice_url?: string;
  status_transitions: { paid_at: number | null };
}

/** Raw provider subscription — stored in {provider}/subscriptions.json */
interface ProviderSubscription {
  id: string;
  source: "stripe" | "odoo";
  emailHash: string;
  firstName: string;
  lastName: string;
  plan: "monthly" | "yearly";
  amount: Amount;
  interval: "month" | "year";
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  latestPayment: Member["latestPayment"];
  subscriptionUrl?: string;
  createdAt: string;
  discord?: string | null;
  isOrganization?: boolean;
  productId?: string | number;
}

interface ProviderSnapshot {
  provider: "stripe" | "odoo";
  fetchedAt: string;
  subscriptions: ProviderSubscription[];
}

interface PrivateMemberData {
  firstName: string;
  lastName: string;
  email: string;
  emailHash: string;
  discord: string | null;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  source: string;
  lastPaymentDate: string | null;
  createdAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function validateSalt(): string {
  if (!EMAIL_HASH_SALT) {
    console.error("❌ EMAIL_HASH_SALT not set");
    process.exit(1);
  }
  const valid = ["prod-", "staging-", "preview-", "dev-", "test-"];
  if (!valid.some((p) => EMAIL_HASH_SALT.startsWith(p))) {
    console.warn("⚠️  EMAIL_HASH_SALT should be prefixed with environment");
  }
  return EMAIL_HASH_SALT;
}

function hashEmail(email: string, salt: string): string {
  return crypto.createHash("sha256").update(email.toLowerCase().trim() + salt).digest("hex");
}

function amt(value: number, currency = "EUR", decimals = 2): Amount {
  return { value, decimals, currency: currency.toUpperCase() };
}

function names(name: string | null): { firstName: string; lastName: string } {
  if (!name) return { firstName: "Member", lastName: "" };
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function writeJSON(filePath: string, data: any) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ─── Stripe ─────────────────────────────────────────────────────────────────

async function stripeAPI(endpoint: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(`https://api.stripe.com/v1${endpoint}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchAllStripeSubscriptions(): Promise<StripeSubscription[]> {
  const all: StripeSubscription[] = [];
  let startingAfter: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const params: Record<string, string> = { limit: "100", status: "all", "expand[]": "data.latest_invoice" };
    if (startingAfter) params.starting_after = startingAfter;
    const data = await stripeAPI("/subscriptions", params);
    const filtered = data.data.filter((s: StripeSubscription) =>
      s.items.data.some((i) => i.price.product === STRIPE_PRODUCT_ID)
    );
    all.push(...filtered);
    hasMore = data.has_more && data.data.length > 0;
    if (hasMore) startingAfter = data.data[data.data.length - 1].id;
  }
  return all;
}

function isActiveInMonth(sub: StripeSubscription, year: number, month: number): boolean {
  const monthStart = new Date(year, month - 1, 1).getTime() / 1000;
  const monthEnd = new Date(year, month, 0, 23, 59, 59).getTime() / 1000;
  if (sub.created > monthEnd) return false;

  const active = ["active", "trialing", "past_due"];
  if (active.includes(sub.status)) {
    return sub.current_period_start <= monthEnd && sub.current_period_end >= monthStart;
  }
  if (sub.status === "canceled") {
    const canceledAt = sub.canceled_at || sub.ended_at;
    if (canceledAt && canceledAt < monthStart) return false;
    return sub.current_period_start <= monthEnd &&
      (canceledAt ? canceledAt >= monthStart : sub.current_period_end >= monthStart);
  }
  return false;
}

async function buildStripeSnapshot(
  subscriptions: StripeSubscription[],
  year: number,
  month: number,
  salt: string,
  customerCache: Map<string, StripeCustomer>,
  privateData: PrivateMemberData[],
): Promise<ProviderSnapshot> {
  const active = subscriptions.filter((s) => isActiveInMonth(s, year, month));
  const subs: ProviderSubscription[] = [];

  for (const sub of active) {
    try {
      let cust = customerCache.get(sub.customer);
      if (!cust) {
        cust = await stripeAPI(`/customers/${sub.customer}`);
        customerCache.set(sub.customer, cust!);
      }

      const priceItem = sub.items.data.find((i) => i.price.product === STRIPE_PRODUCT_ID);
      const price = priceItem?.price;
      const currency = (price?.currency || "eur").toUpperCase();
      const unitAmount = (price?.unit_amount || 0) / 100;

      let latestPayment: Member["latestPayment"] = null;
      let lastPaymentDate: string | null = null;

      const inv = typeof sub.latest_invoice === "object" ? sub.latest_invoice as StripeInvoice
        : typeof sub.latest_invoice === "string" ? await stripeAPI(`/invoices/${sub.latest_invoice}`).catch(() => null)
        : null;

      if (inv && inv.status === "paid") {
        const d = new Date((inv.status_transitions?.paid_at || inv.created) * 1000).toISOString().split("T")[0];
        lastPaymentDate = d;
        latestPayment = {
          date: d,
          amount: amt(inv.amount_paid / 100, inv.currency || currency),
          status: "succeeded",
          url: inv.hosted_invoice_url || `https://dashboard.stripe.com/invoices/${inv.id}`,
        };
      }

      const discord = sub.metadata?.client_reference_id || sub.metadata?.discord_username || cust!.metadata?.discord_username || null;
      const { firstName, lastName } = names(cust!.name);
      const emailHash = hashEmail(cust!.email, salt);

      subs.push({
        id: sub.id.substring(0, 14) + "...",
        source: "stripe",
        emailHash,
        firstName,
        lastName,
        plan: price?.recurring?.interval === "year" ? "yearly" : "monthly",
        amount: amt(unitAmount, currency),
        interval: price?.recurring?.interval || "month",
        status: sub.status,
        currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString().split("T")[0],
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString().split("T")[0],
        latestPayment,
        subscriptionUrl: `https://dashboard.stripe.com/subscriptions/${sub.id}`,
        createdAt: new Date(sub.created * 1000).toISOString().split("T")[0],
        discord,
        productId: STRIPE_PRODUCT_ID,
      });

      privateData.push({
        firstName, lastName, email: cust!.email, emailHash, discord,
        plan: price?.recurring?.interval === "year" ? "yearly" : "monthly",
        amount: unitAmount, currency, status: sub.status, source: "stripe",
        lastPaymentDate, createdAt: new Date(sub.created * 1000).toISOString().split("T")[0],
      });
    } catch (err) {
      console.error(`  ⚠️  Stripe sub ${sub.id}:`, err);
    }
  }

  return { provider: "stripe", fetchedAt: new Date().toISOString(), subscriptions: subs };
}

// ─── Odoo ───────────────────────────────────────────────────────────────────

let _odooUid: number | null = null;

async function odooRPC(service: string, method: string, args: any[]): Promise<any> {
  const res = await fetch(`${ODOO_CONFIG.url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "call", params: { service, method, args } }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.data?.message || data.error.message || "Odoo error");
  return data.result;
}

async function odooAuth(): Promise<number> {
  if (_odooUid) return _odooUid;
  _odooUid = await odooRPC("common", "authenticate", [ODOO_CONFIG.db, ODOO_LOGIN!, ODOO_API_KEY!, {}]);
  if (!_odooUid) throw new Error("Odoo auth failed");
  return _odooUid;
}

async function odooExec(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
  const uid = await odooAuth();
  return odooRPC("object", "execute_kw", [ODOO_CONFIG.db, uid, ODOO_API_KEY!, model, method, args, kwargs]);
}

async function buildOdooSnapshot(
  salt: string,
  privateData: PrivateMemberData[],
): Promise<ProviderSnapshot> {
  const productTemplateIds = ODOO_CONFIG.products.map((p) => p.id);

  // product.product IDs for our templates
  const ppIds: number[] = await odooExec("product.product", "search", [[["product_tmpl_id", "in", productTemplateIds]]]);
  if (ppIds.length === 0) return { provider: "odoo", fetchedAt: new Date().toISOString(), subscriptions: [] };

  // Active subscriptions
  const orderIds: number[] = await odooExec("sale.order", "search", [[
    ["is_subscription", "=", true],
    ["order_line.product_id", "in", ppIds],
    ["subscription_state", "in", ["3_progress", "4_paused"]],
  ]]);
  if (orderIds.length === 0) return { provider: "odoo", fetchedAt: new Date().toISOString(), subscriptions: [] };

  const orders = await odooExec("sale.order", "read", [orderIds], {
    fields: ["partner_id", "subscription_state", "recurring_monthly", "start_date", "next_invoice_date", "amount_total", "currency_id", "order_line", "plan_id", "invoice_ids"],
  });

  // Fetch latest paid invoice per order
  const allInvoiceIds = [...new Set(orders.flatMap((o: any) => o.invoice_ids || []))];
  const invoices = allInvoiceIds.length > 0
    ? await odooExec("account.move", "read", [allInvoiceIds], {
        fields: ["payment_state", "invoice_date", "amount_total", "currency_id"],
      })
    : [];
  const invoiceMap = new Map(
    invoices
      .filter((inv: any) => inv.payment_state === "paid" || inv.payment_state === "in_payment")
      .map((inv: any) => [inv.id, inv])
  );

  // Partners
  const partnerIds = [...new Set(orders.map((o: any) => o.partner_id[0]))];
  const partners = await odooExec("res.partner", "read", [partnerIds], { fields: ["name", "email", "is_company"] });
  const partnerMap = new Map(partners.map((p: any) => [p.id, p]));

  // Order line → product template mapping
  const allLineIds = orders.flatMap((o: any) => o.order_line);
  const lines = allLineIds.length > 0
    ? await odooExec("sale.order.line", "read", [allLineIds], { fields: ["product_id", "order_id"] })
    : [];
  const lineProductIds = [...new Set(lines.map((l: any) => l.product_id[0]))];
  const ppProducts = lineProductIds.length > 0
    ? await odooExec("product.product", "read", [lineProductIds], { fields: ["product_tmpl_id"] })
    : [];
  const ppToTmpl = new Map(ppProducts.map((p: any) => [p.id, p.product_tmpl_id[0]]));

  const orderToTemplate = new Map<number, number>();
  for (const line of lines) {
    const tmplId = ppToTmpl.get(line.product_id[0]);
    if (tmplId && productTemplateIds.includes(tmplId)) {
      orderToTemplate.set(line.order_id[0], tmplId);
    }
  }

  const subs: ProviderSubscription[] = [];

  for (const order of orders) {
    const partner = partnerMap.get(order.partner_id[0]);
    if (!partner) continue;

    const email = partner.email || "";
    const emailHash = email ? hashEmail(email, salt) : `odoo-noemail-${order.id}`;
    const { firstName, lastName } = names(partner.name);

    const tmplId = orderToTemplate.get(order.id);
    const productConfig = ODOO_CONFIG.products.find((p) => p.id === tmplId);
    const interval = (productConfig?.interval || "month") as "month" | "year";
    const isOrg = tmplId === 104 || partner.is_company;

    const status = order.subscription_state === "4_paused" ? "paused" : "active";
    const totalAmount = order.recurring_monthly * (interval === "year" ? 12 : 1);

    // Find latest paid invoice
    let latestPayment: ProviderSubscription["latestPayment"] = null;
    let lastPaymentDate: string | null = null;
    const orderInvoiceIds = (order.invoice_ids || []) as number[];
    const paidInvoices = orderInvoiceIds
      .map((id: number) => invoiceMap.get(id))
      .filter(Boolean)
      .sort((a: any, b: any) => (b.invoice_date || "").localeCompare(a.invoice_date || ""));
    if (paidInvoices.length > 0) {
      const inv = paidInvoices[0];
      lastPaymentDate = inv.invoice_date || null;
      latestPayment = {
        date: inv.invoice_date || "",
        amount: amt(inv.amount_total, inv.currency_id?.[1] || "EUR"),
        status: "succeeded",
        url: `${ODOO_CONFIG.url}/web#id=${inv.id}&model=account.move&view_type=form`,
      };
    }

    subs.push({
      id: `odoo-${order.id}`,
      source: "odoo",
      emailHash,
      firstName,
      lastName,
      plan: interval === "year" ? "yearly" : "monthly",
      amount: amt(totalAmount),
      interval,
      status,
      currentPeriodStart: order.start_date || "",
      currentPeriodEnd: order.next_invoice_date || "",
      latestPayment,
      subscriptionUrl: `${ODOO_CONFIG.url}/web#id=${order.id}&model=sale.order&view_type=form`,
      createdAt: order.start_date || "",
      discord: null,
      isOrganization: isOrg,
      productId: tmplId,
    });

    privateData.push({
      firstName, lastName, email, emailHash, discord: null,
      plan: interval === "year" ? "yearly" : "monthly",
      amount: totalAmount, currency: "EUR", status, source: "odoo",
      lastPaymentDate, createdAt: order.start_date || "",
    });
  }

  return { provider: "odoo", fetchedAt: new Date().toISOString(), subscriptions: subs };
}

// ─── Merge ──────────────────────────────────────────────────────────────────

function mergeSnapshots(snapshots: ProviderSnapshot[]): Member[] {
  // Stripe takes priority on duplicates (by emailHash)
  const seen = new Map<string, Member>();

  // Process stripe first, then odoo
  const ordered = [...snapshots].sort((a, b) => (a.provider === "stripe" ? -1 : 1));

  for (const snap of ordered) {
    for (const sub of snap.subscriptions) {
      if (seen.has(sub.emailHash)) continue; // Stripe already claimed this email

      const member: Member = {
        id: sub.id,
        source: sub.source,
        accounts: { emailHash: sub.emailHash, discord: sub.discord },
        firstName: sub.firstName,
        plan: sub.plan,
        amount: sub.amount,
        interval: sub.interval,
        status: sub.status as Member["status"],
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        latestPayment: sub.latestPayment,
        subscriptionUrl: sub.subscriptionUrl,
        createdAt: sub.createdAt,
        isOrganization: sub.isOrganization,
      };

      seen.set(sub.emailHash, member);
    }
  }

  return [...seen.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function calculateSummary(members: Member[]): MembersSummary {
  const active = members.filter((m) => m.status === "active" || m.status === "trialing");
  const monthly = active.filter((m) => m.plan === "monthly");
  const yearly = active.filter((m) => m.plan === "yearly");
  const monthlyMrr = monthly.reduce((s, m) => s + m.amount.value, 0);
  const yearlyMrr = yearly.reduce((s, m) => s + m.amount.value / 12, 0);

  return {
    totalMembers: members.length,
    activeMembers: active.length,
    monthlyMembers: monthly.length,
    yearlyMembers: yearly.length,
    mrr: amt(Math.round((monthlyMrr + yearlyMrr) * 100) / 100),
  };
}

function generateCSV(data: PrivateMemberData[]): string {
  const headers = ["firstName", "lastName", "email", "emailHash", "discord", "plan", "amount", "currency", "status", "source", "lastPaymentDate", "createdAt"];
  const rows = data.map((m) =>
    [m.firstName, m.lastName, m.email, m.emailHash, m.discord || "", m.plan, m.amount.toString(), m.currency, m.status, m.source, m.lastPaymentDate || "", m.createdAt]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

// ─── Main ───────────────────────────────────────────────────────────────────

function getMonthsToProcess(args: string[]): Array<{ year: number; month: number }> {
  const now = new Date();
  const monthArg = args.find((a) => a.startsWith("--month="));
  if (monthArg) {
    const [y, m] = monthArg.replace("--month=", "").split("-").map(Number);
    return [{ year: y, month: m }];
  }
  if (args.includes("--backfill")) {
    const months: Array<{ year: number; month: number }> = [];
    let y = 2024, m = 6;
    while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
      months.push({ year: y, month: m });
      if (++m > 12) { m = 1; y++; }
    }
    return months;
  }
  return [{ year: now.getFullYear(), month: now.getMonth() + 1 }];
}

async function processMonth(
  year: number,
  month: number,
  stripeSubscriptions: StripeSubscription[] | null,
  customerCache: Map<string, StripeCustomer>,
  salt: string,
  flags: { stripe: boolean; odoo: boolean },
) {
  const monthStr = String(month).padStart(2, "0");
  const yearStr = String(year);
  const monthDir = path.join(DATA_DIR, yearStr, monthStr);
  const privateData: PrivateMemberData[] = [];

  console.log(`\n📅 ${yearStr}-${monthStr}`);

  const snapshots: ProviderSnapshot[] = [];

  // ── Stripe ──
  if (flags.stripe && stripeSubscriptions) {
    const snap = await buildStripeSnapshot(stripeSubscriptions, year, month, salt, customerCache, privateData);
    console.log(`  Stripe: ${snap.subscriptions.length} subscriptions`);
    writeJSON(path.join(monthDir, "stripe", "subscriptions.json"), snap);
    snapshots.push(snap);
  } else {
    // Try loading existing snapshot
    const existing = path.join(monthDir, "stripe", "subscriptions.json");
    if (fs.existsSync(existing)) {
      snapshots.push(JSON.parse(fs.readFileSync(existing, "utf-8")));
      console.log(`  Stripe: loaded from cache`);
    }
  }

  // ── Odoo (only for current month — Odoo API gives current state, not historical) ──
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  if (flags.odoo && ODOO_API_KEY && ODOO_LOGIN && isCurrentMonth) {
    try {
      const snap = await buildOdooSnapshot(salt, privateData);
      console.log(`  Odoo: ${snap.subscriptions.length} subscriptions`);
      writeJSON(path.join(monthDir, "odoo", "subscriptions.json"), snap);
      snapshots.push(snap);
    } catch (err) {
      console.error(`  ⚠️  Odoo fetch failed:`, err);
      // Try loading existing
      const existing = path.join(monthDir, "odoo", "subscriptions.json");
      if (fs.existsSync(existing)) {
        snapshots.push(JSON.parse(fs.readFileSync(existing, "utf-8")));
        console.log(`  Odoo: loaded from cache (fallback)`);
      }
    }
  } else {
    // Load existing Odoo snapshot if available
    const existing = path.join(monthDir, "odoo", "subscriptions.json");
    if (fs.existsSync(existing)) {
      snapshots.push(JSON.parse(fs.readFileSync(existing, "utf-8")));
      console.log(`  Odoo: loaded from cache`);
    }
  }

  if (snapshots.length === 0) {
    console.log(`  No data for this month`);
    return;
  }

  // ── Merge ──
  const members = mergeSnapshots(snapshots);
  const summary = calculateSummary(members);

  const output: MembersFile = {
    year: yearStr,
    month: monthStr,
    productId: "mixed",
    generatedAt: new Date().toISOString(),
    summary,
    members,
  };

  writeJSON(path.join(monthDir, "members.json"), output);
  console.log(`  ✅ ${members.length} members (active: ${summary.activeMembers}, MRR: €${summary.mrr.value})`);

  // ── Private CSV ──
  if (privateData.length > 0) {
    const csvPath = path.join(monthDir, "private", "members.csv");
    fs.mkdirSync(path.dirname(csvPath), { recursive: true });
    fs.writeFileSync(csvPath, generateCSV(privateData));
    console.log(`  🔒 Private CSV: ${privateData.length} rows`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const stripeOnly = args.includes("--stripe-only");
  const odooOnly = args.includes("--odoo-only");
  const flags = {
    stripe: !odooOnly,
    odoo: !stripeOnly,
  };

  console.log("🔄 Fetching membership data\n");

  const salt = validateSalt();
  const months = getMonthsToProcess(args);
  console.log(`📆 ${months.length} month(s) to process`);

  // Fetch Stripe subscriptions (once, filter per month)
  let stripeSubscriptions: StripeSubscription[] | null = null;
  const customerCache = new Map<string, StripeCustomer>();

  if (flags.stripe && STRIPE_SECRET_KEY) {
    console.log("📥 Fetching Stripe subscriptions...");
    stripeSubscriptions = await fetchAllStripeSubscriptions();
    console.log(`  ${stripeSubscriptions.length} total Stripe subscriptions`);
  } else if (flags.stripe) {
    console.warn("⚠️  STRIPE_SECRET_KEY not set, skipping Stripe");
    flags.stripe = false;
  }

  if (flags.odoo && (!ODOO_API_KEY || !ODOO_LOGIN)) {
    console.warn("⚠️  ODOO_API_KEY / ODOO_LOGIN not set, skipping Odoo");
    flags.odoo = false;
  }

  for (const { year, month } of months) {
    await processMonth(year, month, stripeSubscriptions, customerCache, salt, flags);
  }

  console.log("\n✅ Done!");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
