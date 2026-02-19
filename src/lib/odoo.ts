/**
 * Odoo JSON-RPC client for fetching subscription/membership data.
 *
 * Requires env vars:
 *   ODOO_API_KEY  – API key (replaces password)
 *   ODOO_LOGIN    – login email for the API user
 *
 * Config comes from settings.json → membership.odoo
 */

import settings from "@/settings/settings.json";

const { url: ODOO_URL, db: ODOO_DB } = settings.membership.odoo;

let _uid: number | null = null;

function getCredentials() {
  const apiKey = process.env.ODOO_API_KEY;
  const login = process.env.ODOO_LOGIN;
  if (!apiKey || !login) {
    throw new Error("ODOO_API_KEY and ODOO_LOGIN env vars are required");
  }
  return { apiKey, login };
}

/**
 * Low-level JSON-RPC call to Odoo
 */
async function jsonrpc(url: string, method: string, params: any): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });
  const data = await res.json();
  if (data.error) {
    const msg = data.error.data?.message || data.error.message || JSON.stringify(data.error);
    throw new Error(`Odoo RPC error: ${msg}`);
  }
  return data.result;
}

/**
 * Authenticate and cache uid
 */
async function authenticate(): Promise<number> {
  if (_uid) return _uid;
  const { apiKey, login } = getCredentials();
  const uid = await jsonrpc(`${ODOO_URL}/jsonrpc`, "call", {
    service: "common",
    method: "authenticate",
    args: [ODOO_DB, login, apiKey, {}],
  });
  if (!uid) throw new Error("Odoo authentication failed");
  _uid = uid;
  return uid;
}

/**
 * Call a model method via execute_kw
 */
async function execute(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
  const uid = await authenticate();
  const { apiKey, login } = getCredentials();
  return jsonrpc(`${ODOO_URL}/jsonrpc`, "call", {
    service: "object",
    method: "execute_kw",
    args: [ODOO_DB, uid, apiKey, model, method, args, kwargs],
  });
}

export interface OdooSubscription {
  id: number;
  partner_id: [number, string]; // [id, name]
  partner_name?: string;
  partner_email?: string;
  stage_id?: [number, string];
  state?: string; // e.g. "3_progress" for in progress
  recurring_monthly: number;
  start_date: string | false;
  next_invoice_date: string | false;
  amount_total: number;
  currency_id: [number, string];
  order_line: number[];
  plan_id?: [number, string];
}

export interface OdooPartner {
  id: number;
  name: string;
  email: string | false;
  is_company: boolean;
}

/**
 * Fetch active subscriptions for the configured membership products.
 * Odoo 17 uses sale.order with is_subscription=True.
 */
export async function fetchMembershipSubscriptions(): Promise<OdooSubscription[]> {
  const productIds = settings.membership.odoo.products.map((p) => p.id);

  // First get product.product ids for those product.template ids
  const productProductIds: number[] = await execute(
    "product.product",
    "search",
    [[["product_tmpl_id", "in", productIds]]],
  );

  if (productProductIds.length === 0) return [];

  // Find sale.order (subscriptions) that contain these products and are active
  // In Odoo 17, subscriptions are sale.orders with is_subscription=True
  // State "sale" or stage "in_progress" means active
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

  if (orderIds.length === 0) return [];

  const orders: OdooSubscription[] = await execute(
    "sale.order",
    "read",
    [orderIds],
    {
      fields: [
        "partner_id",
        "stage_id",
        "subscription_state",
        "recurring_monthly",
        "start_date",
        "next_invoice_date",
        "amount_total",
        "currency_id",
        "order_line",
        "plan_id",
      ],
    },
  );

  // Fetch partner emails
  const partnerIds = [...new Set(orders.map((o) => o.partner_id[0]))];
  const partners: OdooPartner[] = await execute(
    "res.partner",
    "read",
    [partnerIds],
    { fields: ["name", "email", "is_company"] },
  );
  const partnerMap = new Map(partners.map((p) => [p.id, p]));

  // Enrich orders with partner info
  for (const order of orders) {
    const partner = partnerMap.get(order.partner_id[0]);
    if (partner) {
      order.partner_name = partner.name;
      order.partner_email = partner.email || undefined;
    }
  }

  return orders;
}

/**
 * Determine the subscription plan (monthly/yearly) from the order lines.
 * Looks up which product template the order line references.
 */
export async function getOrderLineProducts(orderLineIds: number[]): Promise<Map<number, number>> {
  if (orderLineIds.length === 0) return new Map();

  const lines = await execute(
    "sale.order.line",
    "read",
    [orderLineIds],
    { fields: ["product_id", "order_id"] },
  );

  // Map order_id → product template id
  const productProductIds = [...new Set(lines.map((l: any) => l.product_id[0]))];
  const products = await execute(
    "product.product",
    "read",
    [productProductIds],
    { fields: ["product_tmpl_id"] },
  );
  const ppToTmpl = new Map(products.map((p: any) => [p.id, p.product_tmpl_id[0]]));

  const orderToTemplate = new Map<number, number>();
  for (const line of lines) {
    const tmplId = ppToTmpl.get(line.product_id[0]);
    if (tmplId && settings.membership.odoo.products.some((p) => p.id === tmplId)) {
      orderToTemplate.set(line.order_id[0], tmplId);
    }
  }

  return orderToTemplate;
}

/**
 * Check if Odoo integration is configured
 */
export function isOdooConfigured(): boolean {
  return !!(process.env.ODOO_API_KEY && process.env.ODOO_LOGIN);
}
