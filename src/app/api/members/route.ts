/**
 * API route to get membership data
 * 
 * Merges:
 * - Static Stripe data from data/{year}/{month}/members.json
 * - Live Odoo subscription data (if ODOO_API_KEY is configured)
 * 
 * GET /api/members - Returns members for current month
 * GET /api/members?year=2026&month=01 - Returns members for specific month
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type { Member, MembersFile, MembersSummary, Amount } from "@/types/members";
import settings from "@/settings/settings.json";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

// Cache Odoo results for 5 minutes
let odooCache: { members: Member[]; fetchedAt: number } | null = null;
const ODOO_CACHE_TTL = 5 * 60 * 1000;

function createAmount(value: number, currency = "EUR", decimals = 2): Amount {
  return { value, decimals, currency };
}

/**
 * Fetch members from Odoo via JSON-RPC
 */
async function fetchOdooMembers(): Promise<Member[]> {
  const apiKey = process.env.ODOO_API_KEY;
  const login = process.env.ODOO_LOGIN;
  if (!apiKey || !login) return [];

  // Check cache
  if (odooCache && Date.now() - odooCache.fetchedAt < ODOO_CACHE_TTL) {
    return odooCache.members;
  }

  const { url: ODOO_URL, db: ODOO_DB, products } = settings.membership.odoo;

  try {
    // JSON-RPC helper
    async function rpc(service: string, method: string, args: any[]): Promise<any> {
      const res = await fetch(`${ODOO_URL}/jsonrpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "call",
          params: { service, method, args },
        }),
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error.data?.message || data.error.message || "Odoo RPC error");
      }
      return data.result;
    }

    // Authenticate
    const uid = await rpc("common", "authenticate", [ODOO_DB, login, apiKey, {}]);
    if (!uid) throw new Error("Odoo auth failed");

    // execute_kw helper
    async function execute(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
      return rpc("object", "execute_kw", [ODOO_DB, uid, apiKey, model, method, args, kwargs]);
    }

    // Get product.product IDs for our membership product templates
    const productTemplateIds = products.map((p: any) => p.id);
    const productProductIds: number[] = await execute(
      "product.product",
      "search",
      [[["product_tmpl_id", "in", productTemplateIds]]],
    );

    if (productProductIds.length === 0) {
      odooCache = { members: [], fetchedAt: Date.now() };
      return [];
    }

    // Find active subscriptions containing these products
    const orderIds: number[] = await execute(
      "sale.order",
      "search",
      [
        [
          ["is_subscription", "=", true],
          ["order_line.product_id", "in", productProductIds],
          ["subscription_state", "in", ["3_progress", "4_paused"]],
        ],
      ],
    );

    if (orderIds.length === 0) {
      odooCache = { members: [], fetchedAt: Date.now() };
      return [];
    }

    // Read subscription data
    const orders = await execute(
      "sale.order",
      "read",
      [orderIds],
      {
        fields: [
          "partner_id", "subscription_state", "recurring_monthly",
          "start_date", "next_invoice_date", "amount_total",
          "currency_id", "order_line", "plan_id",
        ],
      },
    );

    // Fetch partner details
    const partnerIds = [...new Set(orders.map((o: any) => o.partner_id[0]))];
    const partners = await execute(
      "res.partner",
      "read",
      [partnerIds],
      { fields: ["name", "email", "is_company"] },
    );
    const partnerMap = new Map(partners.map((p: any) => [p.id, p]));

    // Fetch order lines to determine which product template each order uses
    const allLineIds = orders.flatMap((o: any) => o.order_line);
    const lines = allLineIds.length > 0
      ? await execute("sale.order.line", "read", [allLineIds], { fields: ["product_id", "order_id"] })
      : [];

    // Map product.product → product.template
    const lineProductIds = [...new Set(lines.map((l: any) => l.product_id[0]))];
    const ppProducts = lineProductIds.length > 0
      ? await execute("product.product", "read", [lineProductIds], { fields: ["product_tmpl_id"] })
      : [];
    const ppToTmpl = new Map(ppProducts.map((p: any) => [p.id, p.product_tmpl_id[0]]));

    // Map order ID → product template ID (for our membership products)
    const orderToTemplate = new Map<number, number>();
    for (const line of lines) {
      const tmplId = ppToTmpl.get(line.product_id[0]);
      if (tmplId && productTemplateIds.includes(tmplId)) {
        orderToTemplate.set(line.order_id[0], tmplId);
      }
    }

    // Convert to Member format
    const salt = process.env.EMAIL_HASH_SALT || "dev-odoo-default";
    const members: Member[] = [];

    for (const order of orders) {
      const partner = partnerMap.get(order.partner_id[0]);
      if (!partner) continue;

      const email = partner.email || "";
      const emailHash = crypto.createHash("sha256").update(email.toLowerCase().trim() + salt).digest("hex");

      // Determine plan from product template
      const tmplId = orderToTemplate.get(order.id);
      const productConfig = products.find((p: any) => p.id === tmplId);
      const interval = productConfig?.interval || "month";
      const isOrg = tmplId === 104; // Non-profit membership

      const name = partner.name || "Member";
      const firstName = name.split(/\s+/)[0];

      const status = order.subscription_state === "4_paused" ? "paused" as const : "active" as const;

      const member: Member = {
        id: `odoo-${order.id}`,
        source: "odoo",
        accounts: { emailHash },
        firstName,
        plan: interval === "year" ? "yearly" : "monthly",
        amount: createAmount(order.recurring_monthly * (interval === "year" ? 12 : 1), "EUR"),
        interval: interval as "month" | "year",
        status,
        currentPeriodStart: order.start_date || "",
        currentPeriodEnd: order.next_invoice_date || "",
        latestPayment: null, // Could fetch invoices but not needed for now
        createdAt: order.start_date || "",
        isOrganization: isOrg || partner.is_company,
      };

      members.push(member);
    }

    odooCache = { members, fetchedAt: Date.now() };
    return members;
  } catch (error) {
    console.error("Error fetching Odoo members:", error);
    // Return cached data if available, empty otherwise
    return odooCache?.members || [];
  }
}

/**
 * Recalculate summary from merged members
 */
function recalculateSummary(members: Member[]): MembersSummary {
  const activeMembers = members.filter((m) => m.status === "active" || m.status === "trialing");
  const monthlyMembers = activeMembers.filter((m) => m.plan === "monthly");
  const yearlyMembers = activeMembers.filter((m) => m.plan === "yearly");

  const monthlyMrr = monthlyMembers.reduce((sum, m) => sum + m.amount.value, 0);
  const yearlyMrr = yearlyMembers.reduce((sum, m) => sum + m.amount.value / 12, 0);
  const totalMrr = Math.round((monthlyMrr + yearlyMrr) * 100) / 100;

  return {
    totalMembers: members.length,
    activeMembers: activeMembers.length,
    monthlyMembers: monthlyMembers.length,
    yearlyMembers: yearlyMembers.length,
    mrr: createAmount(totalMrr, "EUR"),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const now = new Date();
  const year = searchParams.get("year") || String(now.getFullYear());
  const month = searchParams.get("month") || String(now.getMonth() + 1).padStart(2, "0");

  // Load Stripe data from static file
  const membersPath = path.join(DATA_DIR, year, month.padStart(2, "0"), "members.json");
  
  let stripeData: MembersFile | null = null;
  if (fs.existsSync(membersPath)) {
    try {
      stripeData = JSON.parse(fs.readFileSync(membersPath, "utf-8"));
    } catch (error) {
      console.error("Error reading Stripe members data:", error);
    }
  }

  // Fetch Odoo members (live, cached 5min)
  const odooMembers = await fetchOdooMembers();

  // If neither source has data, 404
  if (!stripeData && odooMembers.length === 0) {
    return NextResponse.json(
      { error: "Members data not found for this month" },
      { status: 404 }
    );
  }

  // Merge members — deduplicate by email hash
  const stripeMembers = stripeData?.members || [];
  
  // Tag stripe members with source
  for (const m of stripeMembers) {
    if (!m.source) m.source = "stripe";
  }

  // Deduplicate: if same emailHash exists in both, keep the Stripe one (more detailed payment info)
  const emailHashes = new Set(stripeMembers.map((m) => m.accounts.emailHash));
  const uniqueOdooMembers = odooMembers.filter((m) => !emailHashes.has(m.accounts.emailHash));

  const allMembers = [...stripeMembers, ...uniqueOdooMembers];
  const summary = recalculateSummary(allMembers);

  const result: MembersFile = {
    year,
    month: month.padStart(2, "0"),
    productId: stripeData?.productId || "mixed",
    generatedAt: new Date().toISOString(),
    summary,
    members: allMembers,
  };

  return NextResponse.json(result);
}
