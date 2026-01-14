import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "tests/data");

describe("Contributors Data Integrity", () => {
  describe("Yearly Contributors Files", () => {
    it("should have non-empty contributors for 2025", () => {
      const contributorsPath = path.join(DATA_DIR, "2025", "contributors.json");

      expect(fs.existsSync(contributorsPath)).toBe(true);

      const content = fs.readFileSync(contributorsPath, "utf-8");
      const data = JSON.parse(content);

      expect(data.totalContributors).toBeGreaterThan(0);
      expect(data.contributors).toBeInstanceOf(Array);
      expect(data.contributors.length).toBeGreaterThan(0);
      expect(data.activeCommoners).toBeGreaterThan(0);
    });

    it("should aggregate contributors correctly when monthly data exists", () => {
      // Only test years that have meaningful data
      const years = ["2025"];

      for (const year of years) {
        const contributorsPath = path.join(DATA_DIR, year, "contributors.json");

        if (!fs.existsSync(contributorsPath)) continue;

        const content = fs.readFileSync(contributorsPath, "utf-8");
        const data = JSON.parse(content);

        expect(data.totalContributors).toBeGreaterThan(0);
        expect(data.contributors).toBeInstanceOf(Array);
        expect(data.contributors.length).toBeGreaterThan(0);
      }
    });

    it("yearly contributors should aggregate from monthly files", () => {
      const years = ["2024", "2025"];

      for (const year of years) {
        const yearlyPath = path.join(DATA_DIR, year, "contributors.json");

        if (!fs.existsSync(yearlyPath)) continue;

        const yearlyData = JSON.parse(fs.readFileSync(yearlyPath, "utf-8"));

        // Get all monthly contributors with tokens received > 0
        const monthlyUserIdsWithTokens = new Set<string>();
        const yearDir = path.join(DATA_DIR, year);

        if (!fs.existsSync(yearDir)) continue;

        const months = fs
          .readdirSync(yearDir, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
          .map((dirent) => dirent.name);

        for (const month of months) {
          const monthlyPath = path.join(yearDir, month, "contributors.json");
          if (fs.existsSync(monthlyPath)) {
            const monthlyData = JSON.parse(fs.readFileSync(monthlyPath, "utf-8"));
            for (const user of monthlyData.users || []) {
              // Only count users with tokens received > 0
              if ((user.tokensReceived || 0) > 0) {
                monthlyUserIdsWithTokens.add(user.id);
              }
            }
          }
        }

        // Yearly should have all users from monthly files that have tokens > 0
        if (monthlyUserIdsWithTokens.size > 0) {
          expect(yearlyData.totalContributors).toBeGreaterThanOrEqual(monthlyUserIdsWithTokens.size);
        }
      }
    });
  });

  describe("Monthly Contributors Files", () => {
    it("should have at least 3 contributors for 2025/11", () => {
      const contributorsPath = path.join(DATA_DIR, "2025", "11", "contributors.json");

      expect(fs.existsSync(contributorsPath)).toBe(true);

      const content = fs.readFileSync(contributorsPath, "utf-8");
      const data = JSON.parse(content);

      expect(data.userCount).toBeGreaterThanOrEqual(3);
      expect(data.users).toBeInstanceOf(Array);
      expect(data.users.length).toBeGreaterThanOrEqual(3);
    });

    it("all monthly contributors files should have valid structure", () => {
      const years = ["2024", "2025"];

      for (const year of years) {
        const yearDir = path.join(DATA_DIR, year);

        if (!fs.existsSync(yearDir)) continue;

        const months = fs
          .readdirSync(yearDir, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
          .map((dirent) => dirent.name);

        for (const month of months) {
          const contributorsPath = path.join(yearDir, month, "contributors.json");

          if (!fs.existsSync(contributorsPath)) continue;

          const content = fs.readFileSync(contributorsPath, "utf-8");
          const data = JSON.parse(content);

          // Should have expected structure
          expect(data).toHaveProperty("year");
          expect(data).toHaveProperty("month");
          expect(data).toHaveProperty("userCount");
          expect(data).toHaveProperty("users");

          // Basic validation
          expect(data.year).toBe(year);
          expect(data.month).toBe(month);
          expect(data.userCount).toBe(data.users.length);

          // Each user should have required fields
          for (const user of data.users) {
            expect(user).toHaveProperty("id");
            expect(user).toHaveProperty("username");
            expect(user.id).toBeTruthy();
            expect(user.username).toBeTruthy();
          }
        }
      }
    });
  });

  describe("Data Consistency", () => {
    it("all yearly contributors should have either contributionCount > 0 or tokensReceived > 0", () => {
      const years = ["2024", "2025"];

      for (const year of years) {
        const yearlyPath = path.join(DATA_DIR, year, "contributors.json");

        if (!fs.existsSync(yearlyPath)) continue;

        const yearlyData = JSON.parse(fs.readFileSync(yearlyPath, "utf-8"));

        // Every contributor must have either Discord contributions or tokens received
        for (const contributor of yearlyData.contributors) {
          expect(
            contributor.contributionCount > 0 || contributor.tokensReceived > 0
          ).toBe(true);
        }
      }
    });

    it("should have matching user IDs between monthly and yearly contributors", () => {
      const year = "2025";
      const yearlyPath = path.join(DATA_DIR, year, "contributors.json");

      if (!fs.existsSync(yearlyPath)) {
        // Skip if yearly file doesn't exist
        return;
      }

      const yearlyData = JSON.parse(fs.readFileSync(yearlyPath, "utf-8"));
      const yearlyUserIds = new Set(yearlyData.contributors.map((c: any) => c.id));

      // Get all monthly user IDs
      const monthlyUserIds = new Set<string>();
      const yearDir = path.join(DATA_DIR, year);

      if (!fs.existsSync(yearDir)) return;

      const months = fs
        .readdirSync(yearDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
        .map((dirent) => dirent.name);

      for (const month of months) {
        const monthlyPath = path.join(yearDir, month, "contributors.json");
        if (fs.existsSync(monthlyPath)) {
          const monthlyData = JSON.parse(fs.readFileSync(monthlyPath, "utf-8"));
          for (const user of monthlyData.users || []) {
            monthlyUserIds.add(user.id);
          }
        }
      }

      // Every yearly contributor should be in monthly files (yearly is subset of monthly)
      // Note: Not all monthly users will be in yearly (users with 0 tokens are filtered out)
      for (const userId of yearlyUserIds) {
        expect(monthlyUserIds.has(userId)).toBe(true);
      }
    });
  });
});
