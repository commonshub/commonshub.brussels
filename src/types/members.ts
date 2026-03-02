/**
 * Members data types
 * Generated from data/{year}/{month}/members.json
 */

/**
 * Monetary amount with currency and precision
 * Use this type whenever storing monetary values
 */
export interface Amount {
  value: number;
  decimals: number;
  currency: string;
}

export interface MemberAccounts {
  emailHash: string;
  discord?: string | null;
  // Future: nostr?: string | null;
}

export interface MemberPayment {
  date: string;
  amount: Amount;
  status: "succeeded" | "pending" | "failed";
  url?: string; // Link to invoice/payment on Stripe or Odoo
}

export interface Member {
  id: string; // Stripe subscription ID (truncated) or Odoo order ID
  source?: "stripe" | "odoo"; // Payment provider
  accounts: MemberAccounts;
  firstName: string;
  plan: "monthly" | "yearly";
  amount: Amount;
  interval: "month" | "year";
  status: "active" | "past_due" | "canceled" | "incomplete" | "trialing" | "unpaid" | "paused";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  latestPayment: MemberPayment | null;
  subscriptionUrl?: string; // Link to subscription on Stripe or Odoo
  createdAt: string;
  isOrganization?: boolean; // For Odoo non-profit memberships
}

export interface MembersSummary {
  totalMembers: number;
  activeMembers: number;
  monthlyMembers: number;
  yearlyMembers: number;
  mrr: Amount; // Monthly Recurring Revenue
}

export interface MembersFile {
  year: string;
  month: string;
  productId: string;
  generatedAt: string;
  summary: MembersSummary;
  members: Member[];
}
