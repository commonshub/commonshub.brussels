/**
 * API route to get membership data
 *
 * For the current month, fetches live from both Stripe and Odoo (cached 5min each).
 * For historical months, reads from pre-generated data/{year}/{month}/members.json.
 *
 * GET /api/members              → current month
 * GET /api/members?year=2026&month=01 → specific month
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type { Member, MembersFile, MembersSummary, Amount } from "@/types/members";
import settings from "@/settings/settings.json";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const CACHE_TTL = 5 * 60 * 1000; // 5 min
const ODOO_CONFIG = settings.membership.odoo;
const STRIPE_PRODUCT_ID = settings.membership.stripe.productId;

// ─── Helpers ────────────────────────────────────────────────────────────────

function amt(value: number, currency = "EUR", decimals = 2): Amount {
  return { value, decimals, currency };
}

function hashEmail(email: string): string {
  const salt = process.env.EMAIL_HASH_SALT || "dev-default";
  return crypto.createHash("sha256").update(email.toLowerCase().trim() + salt).digest("hex");
}

function recalcSummary(members: Member[]): MembersSummary {
  const active = members.filter((m) => m.status === "active" || m.status === "trialing");
  const monthly = active.filter((m) => m.plan === "monthly");
  const yearly = active.filter((m) => m.plan === "yearly");
  const mrr = monthly.reduce((s, m) => s + m.amount.value, 0) +
    yearly.reduce((s, m) => s + m.amount.value / 12, 0);
  return {
    totalMembers: members.length,
    activeMembers: active.length,
    monthlyMembers: monthly.length,
    yearlyMembers: yearly.length,
    mrr: amt(Math.round(mrr * 100) / 100),
  };
}

// ─── Live Stripe fetch ──────────────────────────────────────────────────────

let stripeCache: { members: Member[]; at: number } | null = null;

async function fetchLiveStripeMembers(): Promise<Member[]> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return [];
  if (stripeCache && Date.now() - stripeCache.at < CACHE_TTL) return stripeCache.members;

  try {
    const headers = { Authorization: `Bearer ${key}` };

    // Fetch active subscriptions for our product
    const allSubs: any[] = [];
    let startingAfter: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const url = new URL("https://api.stripe.com/v1/subscriptions");
      url.searchParams.set("limit", "100");
      url.searchParams.set("expand[]", "data.latest_invoice");
      // Only fetch active-ish statuses for live view
      url.searchParams.set("status", "all");
      if (startingAfter) url.searchParams.set("starting_after", startingAfter);

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) throw new Error(`Stripe ${res.status}`);
      const data = await res.json();

      const filtered = data.data.filter((s: any) =>
        s.items.data.some((i: any) => i.price.product === STRIPE_PRODUCT_ID) &&
        ["active", "trialing", "past_due"].includes(s.status)
      );
      allSubs.push(...filtered);

      hasMore = data.has_more && data.data.length > 0;
      if (hasMore) startingAfter = data.data[data.data.length - 1].id;
    }

    // Fetch customer details (batched)
    const customerIds = [...new Set(allSubs.map((s: any) => s.customer))];
    const customers = new Map<string, any>();
    for (const cid of customerIds) {
      const res = await fetch(`https://api.stripe.com/v1/customers/${cid}`, { headers });
      if (res.ok) customers.set(cid, await res.json());
    }

    const members: Member[] = [];

    for (const sub of allSubs) {
      const cust = customers.get(sub.customer);
      if (!cust) continue;

      const priceItem = sub.items.data.find((i: any) => i.price.product === STRIPE_PRODUCT_ID);
      const price = priceItem?.price;
      const currency = (price?.currency || "eur").toUpperCase();
      const unitAmount = (price?.unit_amount || 0) / 100;
      const interval = price?.recurring?.interval || "month";

      let latestPayment: Member["latestPayment"] = null;
      if (sub.latest_invoice && typeof sub.latest_invoice === "object") {
        const inv = sub.latest_invoice;
        if (inv.status === "paid") {
          const d = new Date((inv.status_transitions?.paid_at || inv.created) * 1000).toISOString().split("T")[0];
          latestPayment = { date: d, amount: amt(inv.amount_paid / 100, inv.currency || currency), status: "succeeded" };
        }
      }

      const discord = sub.metadata?.client_reference_id || sub.metadata?.discord_username || cust.metadata?.discord_username || null;
      const name = cust.name || "Member";

      members.push({
        id: sub.id.substring(0, 14) + "...",
        source: "stripe",
        accounts: { emailHash: hashEmail(cust.email), discord },
        firstName: name.split(/\s+/)[0],
        plan: interval === "year" ? "yearly" : "monthly",
        amount: amt(unitAmount, currency),
        interval,
        status: sub.status,
        currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString().split("T")[0],
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString().split("T")[0],
        latestPayment,
        createdAt: new Date(sub.created * 1000).toISOString().split("T")[0],
      });
    }

    stripeCache = { members, at: Date.now() };
    return members;
  } catch (err) {
    console.error("Stripe live fetch error:", err);
    return stripeCache?.members || [];
  }
}

// ─── Live Odoo fetch ────────────────────────────────────────────────────────

let odooCache: { members: Member[]; at: number } | null = null;

async function fetchLiveOdooMembers(): Promise<Member[]> {
  const apiKey = process.env.ODOO_API_KEY;
  const login = process.env.ODOO_LOGIN;
  if (!apiKey || !login) return [];
  if (odooCache && Date.now() - odooCache.at < CACHE_TTL) return odooCache.members;

  try {
    async function rpc(service: string, method: string, args: any[]): Promise<any> {
      const res = await fetch(`${ODOO_CONFIG.url}/jsonrpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "call", params: { service, method, args } }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error.data?.message || d.error.message);
      return d.result;
    }

    const uid = await rpc("common", "authenticate", [ODOO_CONFIG.db, login, apiKey, {}]);
    if (!uid) throw new Error("Odoo auth failed");

    async function exec(model: string, method: string, args: any[], kw: any = {}): Promise<any> {
      return rpc("object", "execute_kw", [ODOO_CONFIG.db, uid, apiKey, model, method, args, kw]);
    }

    const tmplIds = ODOO_CONFIG.products.map((p: any) => p.id);
    const ppIds: number[] = await exec("product.product", "search", [[["product_tmpl_id", "in", tmplIds]]]);
    if (!ppIds.length) { odooCache = { members: [], at: Date.now() }; return []; }

    const orderIds: number[] = await exec("sale.order", "search", [[
      ["is_subscription", "=", true],
      ["order_line.product_id", "in", ppIds],
      ["subscription_state", "in", ["3_progress", "4_paused"]],
    ]]);
    if (!orderIds.length) { odooCache = { members: [], at: Date.now() }; return []; }

    const orders = await exec("sale.order", "read", [orderIds], {
      fields: ["partner_id", "subscription_state", "recurring_monthly", "start_date", "next_invoice_date", "order_line", "invoice_ids"],
    });

    // Fetch latest paid invoice per order
    const allInvoiceIds = [...new Set(orders.flatMap((o: any) => o.invoice_ids || []))];
    const invoices = allInvoiceIds.length
      ? await exec("account.move", "read", [allInvoiceIds], {
          fields: ["payment_state", "invoice_date", "amount_total", "currency_id"],
        })
      : [];
    // Map invoice id → invoice, only paid ones
    const invoiceMap = new Map(
      invoices
        .filter((inv: any) => inv.payment_state === "paid" || inv.payment_state === "in_payment")
        .map((inv: any) => [inv.id, inv])
    );

    const partnerIds = [...new Set(orders.map((o: any) => o.partner_id[0]))];
    const partners = await exec("res.partner", "read", [partnerIds], { fields: ["name", "email", "is_company"] });
    const pm = new Map(partners.map((p: any) => [p.id, p]));

    const allLines = orders.flatMap((o: any) => o.order_line);
    const lines = allLines.length ? await exec("sale.order.line", "read", [allLines], { fields: ["product_id", "order_id"] }) : [];
    const ppProductIds = [...new Set(lines.map((l: any) => l.product_id[0]))];
    const pps = ppProductIds.length ? await exec("product.product", "read", [ppProductIds], { fields: ["product_tmpl_id"] }) : [];
    const ppToTmpl = new Map(pps.map((p: any) => [p.id, p.product_tmpl_id[0]]));

    const o2t = new Map<number, number>();
    for (const l of lines) {
      const t = ppToTmpl.get(l.product_id[0]);
      if (t && tmplIds.includes(t)) o2t.set(l.order_id[0], t);
    }

    const members: Member[] = [];
    for (const order of orders) {
      const partner = pm.get(order.partner_id[0]);
      if (!partner) continue;
      const email = partner.email || "";
      const emailHash = email ? hashEmail(email) : `odoo-${order.id}`;
      const tmplId = o2t.get(order.id);
      const pc = ODOO_CONFIG.products.find((p: any) => p.id === tmplId);
      const interval = (pc?.interval || "month") as "month" | "year";

      // Find latest paid invoice for this order
      let latestPayment: Member["latestPayment"] = null;
      const orderInvoiceIds = (order.invoice_ids || []) as number[];
      const paidInvoices = orderInvoiceIds
        .map((id: number) => invoiceMap.get(id))
        .filter(Boolean)
        .sort((a: any, b: any) => (b.invoice_date || "").localeCompare(a.invoice_date || ""));
      if (paidInvoices.length > 0) {
        const inv = paidInvoices[0];
        latestPayment = {
          date: inv.invoice_date || "",
          amount: amt(inv.amount_total, inv.currency_id?.[1] || "EUR"),
          status: "succeeded",
        };
      }

      members.push({
        id: `odoo-${order.id}`,
        source: "odoo",
        accounts: { emailHash },
        firstName: (partner.name || "Member").split(/\s+/)[0],
        plan: interval === "year" ? "yearly" : "monthly",
        amount: amt(order.recurring_monthly * (interval === "year" ? 12 : 1)),
        interval,
        status: order.subscription_state === "4_paused" ? "paused" : "active",
        currentPeriodStart: order.start_date || "",
        currentPeriodEnd: order.next_invoice_date || "",
        latestPayment,
        createdAt: order.start_date || "",
        isOrganization: tmplId === 104 || partner.is_company,
      });
    }

    odooCache = { members, at: Date.now() };
    return members;
  } catch (err) {
    console.error("Odoo live fetch error:", err);
    return odooCache?.members || [];
  }
}

// ─── Route ──────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = searchParams.get("year") || String(now.getFullYear());
  const month = (searchParams.get("month") || String(now.getMonth() + 1)).padStart(2, "0");
  const isCurrentMonth = year === String(now.getFullYear()) && month === String(now.getMonth() + 1).padStart(2, "0");

  // For current month: fetch live from both providers
  if (isCurrentMonth) {
    const [stripeMembers, odooMembers] = await Promise.all([
      fetchLiveStripeMembers(),
      fetchLiveOdooMembers(),
    ]);

    // Also load any static file data as fallback
    const membersPath = path.join(DATA_DIR, year, month, "members.json");
    let staticMembers: Member[] = [];
    if (fs.existsSync(membersPath)) {
      try {
        const file: MembersFile = JSON.parse(fs.readFileSync(membersPath, "utf-8"));
        staticMembers = file.members;
      } catch {}
    }

    // Prefer live data; fall back to static if live returned nothing
    const stripe = stripeMembers.length > 0 ? stripeMembers : staticMembers.filter((m) => m.source !== "odoo");
    const odoo = odooMembers;

    // Merge: Stripe wins on duplicates
    const seen = new Set(stripe.map((m) => m.accounts.emailHash));
    const uniqueOdoo = odoo.filter((m) => !seen.has(m.accounts.emailHash));
    const allMembers = [...stripe, ...uniqueOdoo];

    if (allMembers.length === 0) {
      return NextResponse.json({ error: "Members data not found for this month" }, { status: 404 });
    }

    const data: MembersFile = {
      year,
      month,
      productId: "mixed",
      generatedAt: new Date().toISOString(),
      summary: recalcSummary(allMembers),
      members: allMembers,
    };
    return NextResponse.json(data);
  }

  // Historical months: read from static file only
  const membersPath = path.join(DATA_DIR, year, month, "members.json");
  if (!fs.existsSync(membersPath)) {
    return NextResponse.json({ error: "Members data not found for this month" }, { status: 404 });
  }

  try {
    const data: MembersFile = JSON.parse(fs.readFileSync(membersPath, "utf-8"));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to read members data" }, { status: 500 });
  }
}
