/**
 * Test for November 2025 monthly report
 * This is a past month with finalized data, so we can verify all components work correctly
 */

import { getMonthlyReportData } from "@/lib/reports";

describe("Monthly Report - November 2025", () => {
  let reportData: ReturnType<typeof getMonthlyReportData>;

  beforeAll(() => {
    reportData = getMonthlyReportData("2025", "11");
  });

  describe("Active Members", () => {
    it("should have active members data", () => {
      expect(reportData.activeMembers).toBeDefined();
      expect(reportData.activeMembers.count).toBeGreaterThan(0);
      expect(reportData.activeMembers.users).toBeInstanceOf(Array);
      expect(reportData.activeMembers.users.length).toBe(
        reportData.activeMembers.count
      );
    });

    it("should have user profile data", () => {
      const firstUser = reportData.activeMembers.users[0];
      expect(firstUser).toHaveProperty("id");
      expect(firstUser).toHaveProperty("username");
      expect(firstUser).toHaveProperty("displayName");
      expect(firstUser).toHaveProperty("avatar");
    });

    it("should have token data for users", () => {
      const usersWithTokens = reportData.activeMembers.users.filter(
        (u) => u.tokensReceived && u.tokensReceived > 0
      );
      expect(usersWithTokens.length).toBeGreaterThan(0);

      const firstUserWithTokens = usersWithTokens[0];
      expect(firstUserWithTokens).toHaveProperty("address");
      expect(firstUserWithTokens).toHaveProperty("tokensReceived");
      expect(firstUserWithTokens).toHaveProperty("tokensSpent");
      expect(firstUserWithTokens.address).toBeTruthy();
      expect(typeof firstUserWithTokens.tokensReceived).toBe("number");
      expect(typeof firstUserWithTokens.tokensSpent).toBe("number");
    });

    it("should sort users by tokens received (descending)", () => {
      const usersWithTokens = reportData.activeMembers.users.filter(
        (u) => u.tokensReceived && u.tokensReceived > 0
      );

      for (let i = 0; i < usersWithTokens.length - 1; i++) {
        expect(usersWithTokens[i].tokensReceived).toBeGreaterThanOrEqual(
          usersWithTokens[i + 1].tokensReceived
        );
      }
    });
  });

  describe("Financial Data", () => {
    it("should have financial summary", () => {
      expect(reportData.financials).toBeDefined();
      expect(reportData.financials.income).toBeGreaterThan(0);
      expect(reportData.financials.expenses).toBeGreaterThan(0);
      expect(reportData.financials.net).toBe(
        reportData.financials.income - reportData.financials.expenses
      );
    });

    it("should have token data", () => {
      expect(reportData.financials.tokens).toBeDefined();
      expect(reportData.financials.tokens.minted).toBeGreaterThan(0);
      expect(reportData.financials.tokens.burnt).toBeGreaterThan(0);
      expect(reportData.financials.tokens.net).toBe(
        reportData.financials.tokens.minted - reportData.financials.tokens.burnt
      );
      expect(reportData.financials.tokens.transactionCount).toBeGreaterThan(0);
      expect(reportData.financials.tokens.activeAccounts).toBeGreaterThan(0);
    });

    it("should have breakdown by account", () => {
      expect(reportData.financials.byAccount).toBeInstanceOf(Array);
      expect(reportData.financials.byAccount.length).toBeGreaterThan(0);

      const accounts = reportData.financials.byAccount;

      // Should have Stripe account
      const stripeAccount = accounts.find((a) => a.provider === "stripe");
      expect(stripeAccount).toBeDefined();
      expect(stripeAccount?.slug).toBe("stripe");
      expect(stripeAccount?.name).toContain("Stripe");

      // Should have blockchain accounts (Gnosis)
      const blockchainAccounts = accounts.filter(
        (a) => a.provider === "etherscan"
      );
      expect(blockchainAccounts.length).toBeGreaterThan(0);

      // Each account should have proper structure
      for (const account of accounts) {
        expect(account).toHaveProperty("slug");
        expect(account).toHaveProperty("name");
        expect(account).toHaveProperty("provider");
        expect(account).toHaveProperty("income");
        expect(account).toHaveProperty("expenses");
        expect(account).toHaveProperty("net");
        expect(account.net).toBe(account.income - account.expenses);
      }
    });

    it("should have specific accounts for November 2025", () => {
      const accountSlugs = reportData.financials.byAccount.map((a) => a.slug);

      // Known accounts that should exist
      expect(accountSlugs).toContain("stripe");
      expect(accountSlugs).toContain("savings");
      expect(accountSlugs).toContain("checking");
      expect(accountSlugs).toContain("fridge");
      expect(accountSlugs).toContain("coffee");
    });

    it("should match total income/expenses with account breakdown", () => {
      const totalFromAccounts = reportData.financials.byAccount.reduce(
        (sum, account) => sum + account.income,
        0
      );
      const totalExpensesFromAccounts = reportData.financials.byAccount.reduce(
        (sum, account) => sum + account.expenses,
        0
      );

      // Allow small rounding differences (within 0.01)
      expect(Math.abs(totalFromAccounts - reportData.financials.income)).toBeLessThan(0.01);
      expect(Math.abs(totalExpensesFromAccounts - reportData.financials.expenses)).toBeLessThan(0.01);
    });
  });

  describe("Token Distribution", () => {
    it("should have total tokens received from users", () => {
      const totalUserTokens = reportData.activeMembers.users.reduce(
        (sum, user) => sum + (user.tokensReceived || 0),
        0
      );

      // Users should have received tokens
      // Note: Total received can exceed minted when tokens are transferred between users
      // (e.g., 10 tokens minted to User A, who sends 5 to User B = 15 total received)
      expect(totalUserTokens).toBeGreaterThan(0);

      // But it should be in a reasonable range (not 10x minted, for example)
      expect(totalUserTokens).toBeLessThan(
        reportData.financials.tokens.minted * 10
      );
    });

    it("should have token spending data", () => {
      const totalUserSpent = reportData.activeMembers.users.reduce(
        (sum, user) => sum + (user.tokensSpent || 0),
        0
      );

      // Users should have spent tokens
      // Note: Total spent can exceed burnt when tokens are transferred between users
      expect(totalUserSpent).toBeGreaterThan(0);

      // But it should be in a reasonable range
      expect(totalUserSpent).toBeLessThan(
        reportData.financials.tokens.burnt * 10
      );
    });
  });

  describe("Photos", () => {
    it("should have photos array", () => {
      expect(reportData.photos).toBeInstanceOf(Array);
    });

    it("should have photo metadata if photos exist", () => {
      if (reportData.photos.length > 0) {
        const photo = reportData.photos[0];
        expect(photo).toHaveProperty("url");
        expect(photo).toHaveProperty("author");
        expect(photo).toHaveProperty("reactions");
        expect(photo).toHaveProperty("totalReactions");
        expect(photo).toHaveProperty("timestamp");
        expect(photo).toHaveProperty("channelId");
        expect(photo).toHaveProperty("messageId");
      }
    });

    it("should sort photos by total reactions if photos exist", () => {
      if (reportData.photos.length > 1) {
        for (let i = 0; i < reportData.photos.length - 1; i++) {
          expect(reportData.photos[i].totalReactions).toBeGreaterThanOrEqual(
            reportData.photos[i + 1].totalReactions
          );
        }
      }
    });
  });

  describe("API Endpoint", () => {
    it("should return the same data via API route", async () => {
      const { GET } = await import("@/app/api/reports/[year]/[month]/route");
      const request = new Request(
        "http://localhost:3000/api/reports/2025/11"
      );

      // Mock params as async
      const params = Promise.resolve({ year: "2025", month: "11" });
      const response = await GET(request, { params });

      expect(response.status).toBe(200);

      const apiData = await response.json();

      // Basic structure verification
      expect(apiData.year).toBe("2025");
      expect(apiData.month).toBe("11");
      expect(apiData.activeMembers.count).toBe(reportData.activeMembers.count);
      expect(apiData.financials.income).toBe(reportData.financials.income);
      expect(apiData.financials.tokens.minted).toBe(
        reportData.financials.tokens.minted
      );
    });
  });

  describe("Data Integrity", () => {
    it("should have valid year and month", () => {
      expect(reportData.year).toBe("2025");
      expect(reportData.month).toBe("11");
    });

    it("should not have negative financial values", () => {
      expect(reportData.financials.income).toBeGreaterThanOrEqual(0);
      expect(reportData.financials.expenses).toBeGreaterThanOrEqual(0);

      for (const account of reportData.financials.byAccount) {
        expect(account.income).toBeGreaterThanOrEqual(0);
        expect(account.expenses).toBeGreaterThanOrEqual(0);
      }
    });

    it("should not have negative token values", () => {
      expect(reportData.financials.tokens.minted).toBeGreaterThanOrEqual(0);
      expect(reportData.financials.tokens.burnt).toBeGreaterThanOrEqual(0);
      expect(reportData.financials.tokens.transactionCount).toBeGreaterThanOrEqual(0);
      expect(reportData.financials.tokens.activeAccounts).toBeGreaterThanOrEqual(0);

      for (const user of reportData.activeMembers.users) {
        if (user.tokensReceived !== undefined) {
          expect(user.tokensReceived).toBeGreaterThanOrEqual(0);
        }
        if (user.tokensSpent !== undefined) {
          expect(user.tokensSpent).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });
});
