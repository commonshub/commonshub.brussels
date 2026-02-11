/**
 * Fetch membership subscriptions from Stripe
 * 
 * Generates:
 * - data/{year}/{month}/members.json (public, hashed emails)
 * - data/{year}/{month}/private/members.csv (private, full PII)
 * 
 * Usage:
 *   npx tsx scripts/fetch-members.ts
 *   npx tsx scripts/fetch-members.ts --backfill    # Fetch all historical data
 *   npx tsx scripts/fetch-members.ts --month=2026-02
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type { Member, MembersFile, MembersSummary, Amount } from "../src/types/members";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const NODE_ENV = process.env.NODE_ENV || "development";

// EMAIL_HASH_SALT should be environment-prefixed: [prod|staging|preview|dev]-xxxxx
// This ensures hashes are different per environment for security
const EMAIL_HASH_SALT = process.env.EMAIL_HASH_SALT;

// CHB Membership product
const PRODUCT_ID = "prod_QaSChjphKYLoVs";

// Price IDs (for reference)
// Monthly €10: https://buy.stripe.com/00g9C7dFH8EI07eaEJ
// Yearly €100: https://buy.stripe.com/5kA4hNbxz4os2fm3cl

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
        recurring: {
          interval: "month" | "year";
          interval_count: number;
        };
        product: string;
      };
    }>;
  };
  metadata?: {
    client_reference_id?: string;
    discord_username?: string;
    [key: string]: any;
  };
  latest_invoice?: string | StripeInvoice;
}

interface StripeCustomer {
  id: string;
  email: string;
  name: string | null;
  metadata?: {
    discord_username?: string;
    [key: string]: any;
  };
}

interface StripeInvoice {
  id: string;
  status: string;
  amount_paid: number;
  currency: string;
  created: number;
  status_transitions: {
    paid_at: number | null;
  };
}

// Private member data (for CSV export)
interface PrivateMemberData {
  firstName: string;
  lastName: string;
  email: string;
  emailHash: string;
  discord: string | null;
  plan: "monthly" | "yearly";
  amount: number;
  currency: string;
  status: string;
  lastPaymentDate: string | null;
  createdAt: string;
}

/**
 * Validate EMAIL_HASH_SALT is properly configured
 */
function validateEmailHashSalt(): string {
  if (!EMAIL_HASH_SALT) {
    console.error("❌ EMAIL_HASH_SALT environment variable not set");
    console.error("   Set it with environment prefix: [prod|staging|preview|dev]-your-random-secret");
    console.error("   Example: EMAIL_HASH_SALT=prod-a8f3k2j5h7g9d1s4");
    process.exit(1);
  }

  const validPrefixes = ["prod-", "staging-", "preview-", "dev-", "test-"];
  const hasValidPrefix = validPrefixes.some(prefix => EMAIL_HASH_SALT.startsWith(prefix));

  if (!hasValidPrefix) {
    console.warn("⚠️  EMAIL_HASH_SALT should be prefixed with environment: [prod|staging|preview|dev]-xxx");
    console.warn(`   Current value starts with: ${EMAIL_HASH_SALT.substring(0, 10)}...`);
  }

  return EMAIL_HASH_SALT;
}

/**
 * Hash an email address with salt for privacy-safe linking
 */
function hashEmail(email: string, salt: string): string {
  return crypto
    .createHash("sha256")
    .update(email.toLowerCase().trim() + salt)
    .digest("hex");
}

/**
 * Create an Amount object
 */
function createAmount(value: number, currency: string = "EUR", decimals: number = 2): Amount {
  return { value, decimals, currency: currency.toUpperCase() };
}

/**
 * Extract first and last name from full name
 */
function extractNames(name: string | null): { firstName: string; lastName: string } {
  if (!name) return { firstName: "Member", lastName: "" };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

/**
 * Fetch all subscriptions for our membership product
 */
async function fetchAllSubscriptions(): Promise<StripeSubscription[]> {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not set");
  }

  const headers = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const allSubscriptions: StripeSubscription[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  console.log("📥 Fetching subscriptions from Stripe...");

  while (hasMore) {
    const url = new URL("https://api.stripe.com/v1/subscriptions");
    url.searchParams.set("limit", "100");
    url.searchParams.set("status", "all"); // Include canceled, etc.
    url.searchParams.set("expand[]", "data.latest_invoice");
    if (startingAfter) {
      url.searchParams.set("starting_after", startingAfter);
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch subscriptions: ${response.status} ${error}`);
    }

    const data = await response.json();

    // Filter to our product
    const productSubs = data.data.filter((sub: StripeSubscription) =>
      sub.items.data.some((item) => item.price.product === PRODUCT_ID)
    );

    allSubscriptions.push(...productSubs);

    if (data.has_more && data.data.length > 0) {
      startingAfter = data.data[data.data.length - 1].id;
    } else {
      hasMore = false;
    }
  }

  console.log(`  Found ${allSubscriptions.length} subscriptions for product ${PRODUCT_ID}`);
  return allSubscriptions;
}

/**
 * Fetch customer details
 */
async function fetchCustomer(customerId: string): Promise<StripeCustomer> {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not set");
  }

  const response = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch customer ${customerId}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch invoice details
 */
async function fetchInvoice(invoiceId: string): Promise<StripeInvoice | null> {
  if (!STRIPE_SECRET_KEY || !invoiceId) return null;

  try {
    const response = await fetch(`https://api.stripe.com/v1/invoices/${invoiceId}`, {
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      },
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * Check if a subscription was active during a specific month
 */
function isActiveInMonth(sub: StripeSubscription, year: number, month: number): boolean {
  const monthStart = new Date(year, month - 1, 1).getTime() / 1000;
  const monthEnd = new Date(year, month, 0, 23, 59, 59).getTime() / 1000;

  // Subscription must have started before month end
  if (sub.created > monthEnd) return false;

  // Check status - only include truly active subscriptions
  const activeStatuses = ["active", "trialing", "past_due"];
  
  // If subscription is currently active, check if period overlaps
  if (activeStatuses.includes(sub.status)) {
    return sub.current_period_start <= monthEnd && sub.current_period_end >= monthStart;
  }

  // For canceled subscriptions, check if they were active during that month
  if (sub.status === "canceled") {
    const canceledAt = sub.canceled_at || sub.ended_at;
    if (canceledAt && canceledAt < monthStart) {
      return false; // Canceled before this month
    }
    return sub.current_period_start <= monthEnd && 
           (canceledAt ? canceledAt >= monthStart : sub.current_period_end >= monthStart);
  }

  return false;
}

/**
 * Build member data from subscription
 */
async function buildMemberData(
  sub: StripeSubscription,
  customerCache: Map<string, StripeCustomer>,
  salt: string
): Promise<{ member: Member; privateData: PrivateMemberData }> {
  // Get or fetch customer
  let customer = customerCache.get(sub.customer);
  if (!customer) {
    customer = await fetchCustomer(sub.customer);
    customerCache.set(sub.customer, customer);
  }

  // Get price info
  const priceItem = sub.items.data.find((item) => item.price.product === PRODUCT_ID);
  const price = priceItem?.price;
  const currency = (price?.currency || "eur").toUpperCase();
  const unitAmount = (price?.unit_amount || 0) / 100;

  // Get latest payment info
  let latestPayment: Member["latestPayment"] = null;
  let lastPaymentDate: string | null = null;
  
  if (sub.latest_invoice && typeof sub.latest_invoice === "object") {
    const invoice = sub.latest_invoice as StripeInvoice;
    if (invoice.status === "paid") {
      const paymentDate = new Date((invoice.status_transitions?.paid_at || invoice.created) * 1000)
        .toISOString().split("T")[0];
      lastPaymentDate = paymentDate;
      latestPayment = {
        date: paymentDate,
        amount: createAmount(invoice.amount_paid / 100, invoice.currency || currency),
        status: "succeeded",
      };
    }
  } else if (typeof sub.latest_invoice === "string") {
    const invoice = await fetchInvoice(sub.latest_invoice);
    if (invoice && invoice.status === "paid") {
      const paymentDate = new Date((invoice.status_transitions?.paid_at || invoice.created) * 1000)
        .toISOString().split("T")[0];
      lastPaymentDate = paymentDate;
      latestPayment = {
        date: paymentDate,
        amount: createAmount(invoice.amount_paid / 100, invoice.currency || currency),
        status: "succeeded",
      };
    }
  }

  // Get Discord username from metadata or customer
  const discordUsername = 
    sub.metadata?.client_reference_id ||
    sub.metadata?.discord_username ||
    customer.metadata?.discord_username ||
    null;

  const { firstName, lastName } = extractNames(customer.name);
  const emailHash = hashEmail(customer.email, salt);
  const createdAt = new Date(sub.created * 1000).toISOString().split("T")[0];

  const member: Member = {
    id: sub.id.substring(0, 14) + "...", // Truncate for privacy
    accounts: {
      emailHash,
      discord: discordUsername,
    },
    firstName,
    plan: price?.recurring?.interval === "year" ? "yearly" : "monthly",
    amount: createAmount(unitAmount, currency),
    interval: price?.recurring?.interval || "month",
    status: sub.status as Member["status"],
    currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString().split("T")[0],
    currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString().split("T")[0],
    latestPayment,
    createdAt,
  };

  const privateData: PrivateMemberData = {
    firstName,
    lastName,
    email: customer.email,
    emailHash,
    discord: discordUsername,
    plan: member.plan,
    amount: unitAmount,
    currency,
    status: sub.status,
    lastPaymentDate,
    createdAt,
  };

  return { member, privateData };
}

/**
 * Calculate summary from members
 */
function calculateSummary(members: Member[]): MembersSummary {
  const activeMembers = members.filter((m) => m.status === "active" || m.status === "trialing");
  const monthlyMembers = activeMembers.filter((m) => m.plan === "monthly");
  const yearlyMembers = activeMembers.filter((m) => m.plan === "yearly");

  // MRR: monthly revenue + yearly/12
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

/**
 * Generate CSV from private member data
 */
function generateCSV(privateData: PrivateMemberData[]): string {
  const headers = [
    "firstName",
    "lastName", 
    "email",
    "emailHash",
    "discord",
    "plan",
    "amount",
    "currency",
    "status",
    "lastPaymentDate",
    "createdAt",
  ];

  const rows = privateData.map(m => [
    m.firstName,
    m.lastName,
    m.email,
    m.emailHash,
    m.discord || "",
    m.plan,
    m.amount.toString(),
    m.currency,
    m.status,
    m.lastPaymentDate || "",
    m.createdAt,
  ].map(v => `"${v.replace(/"/g, '""')}"`).join(","));

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Generate members.json and private CSV for a specific month
 */
async function generateMonthlyMembers(
  subscriptions: StripeSubscription[],
  customerCache: Map<string, StripeCustomer>,
  year: number,
  month: number,
  salt: string
): Promise<void> {
  const monthStr = String(month).padStart(2, "0");
  const yearStr = String(year);

  console.log(`\n📅 Processing ${yearStr}-${monthStr}...`);

  // Filter subscriptions active in this month
  const activeInMonth = subscriptions.filter((sub) => isActiveInMonth(sub, year, month));

  if (activeInMonth.length === 0) {
    console.log(`  No active subscriptions for ${yearStr}-${monthStr}`);
    return;
  }

  console.log(`  ${activeInMonth.length} active subscriptions`);

  // Build member data
  const members: Member[] = [];
  const privateDataList: PrivateMemberData[] = [];

  for (const sub of activeInMonth) {
    try {
      const { member, privateData } = await buildMemberData(sub, customerCache, salt);
      members.push(member);
      privateDataList.push(privateData);
    } catch (error) {
      console.error(`  ⚠️  Error processing subscription ${sub.id}:`, error);
    }
  }

  // Sort by creation date (oldest first)
  members.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  privateDataList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const summary = calculateSummary(members);

  const output: MembersFile = {
    year: yearStr,
    month: monthStr,
    productId: PRODUCT_ID,
    generatedAt: new Date().toISOString(),
    summary,
    members,
  };

  // Write public members.json
  const outputDir = path.join(DATA_DIR, yearStr, monthStr);
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, "members.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`  ✅ Written ${members.length} members to ${outputPath}`);
  console.log(`     Active: ${summary.activeMembers}, MRR: €${summary.mrr.value}`);

  // Write private CSV
  const privateDir = path.join(outputDir, "private");
  fs.mkdirSync(privateDir, { recursive: true });

  const csvPath = path.join(privateDir, "members.csv");
  const csv = generateCSV(privateDataList);
  fs.writeFileSync(csvPath, csv);

  console.log(`  🔒 Written private CSV to ${csvPath}`);
}

/**
 * Get months to process based on args
 */
function getMonthsToProcess(args: string[]): Array<{ year: number; month: number }> {
  const months: Array<{ year: number; month: number }> = [];
  const now = new Date();

  // Check for --month=YYYY-MM
  const monthArg = args.find((a) => a.startsWith("--month="));
  if (monthArg) {
    const [year, month] = monthArg.replace("--month=", "").split("-").map(Number);
    return [{ year, month }];
  }

  // Check for --backfill
  if (args.includes("--backfill")) {
    // Start from when Commons Hub started (June 2024)
    const startYear = 2024;
    const startMonth = 6;

    let year = startYear;
    let month = startMonth;

    while (year < now.getFullYear() || (year === now.getFullYear() && month <= now.getMonth() + 1)) {
      months.push({ year, month });
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    return months;
  }

  // Default: current month only
  return [{ year: now.getFullYear(), month: now.getMonth() + 1 }];
}

/**
 * Main
 */
async function main() {
  console.log("🔄 Fetching membership data from Stripe\n");

  if (!STRIPE_SECRET_KEY) {
    console.error("❌ STRIPE_SECRET_KEY environment variable not set");
    process.exit(1);
  }

  const salt = validateEmailHashSalt();

  const args = process.argv.slice(2);
  const monthsToProcess = getMonthsToProcess(args);

  console.log(`📆 Will process ${monthsToProcess.length} month(s)`);
  console.log(`🔐 Using EMAIL_HASH_SALT: ${salt.substring(0, 10)}...`);

  // Fetch all subscriptions once
  const subscriptions = await fetchAllSubscriptions();

  // Customer cache to avoid refetching
  const customerCache = new Map<string, StripeCustomer>();

  // Process each month
  for (const { year, month } of monthsToProcess) {
    await generateMonthlyMembers(subscriptions, customerCache, year, month, salt);
  }

  console.log("\n✅ Done!");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
