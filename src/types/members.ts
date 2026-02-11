/**
 * Members data types
 * Generated from data/{year}/{month}/members.json
 */

export interface MemberAccounts {
  emailHash: string;
  discord?: string | null;
}

export interface MemberPayment {
  date: string;
  amount: number;
  status: "succeeded" | "pending" | "failed";
}

export interface Member {
  id: string; // Stripe subscription ID (truncated for privacy)
  accounts: MemberAccounts;
  firstName: string;
  plan: "monthly" | "yearly";
  amount: number; // EUR
  interval: "month" | "year";
  status: "active" | "past_due" | "canceled" | "incomplete" | "trialing" | "unpaid";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  latestPayment: MemberPayment | null;
  createdAt: string;
}

export interface MembersSummary {
  totalMembers: number;
  activeMembers: number;
  monthlyMembers: number;
  yearlyMembers: number;
  mrr: number; // Monthly Recurring Revenue in EUR
}

export interface MembersFile {
  year: string;
  month: string;
  productId: string;
  generatedAt: string;
  summary: MembersSummary;
  members: Member[];
}
