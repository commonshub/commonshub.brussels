/**
 * Test for November 2025 contributors.json
 * Verifies the new format with profile, tokens, and discord activity data
 */

import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

describe("Contributors - November 2025", () => {
  let contributorsData: any;
  const contributorsPath = path.join(DATA_DIR, "2025", "11", "contributors.json");

  beforeAll(() => {
    // Check if file exists
    expect(fs.existsSync(contributorsPath)).toBe(true);

    // Read the file
    const fileContent = fs.readFileSync(contributorsPath, "utf-8");
    contributorsData = JSON.parse(fileContent);
  });

  describe("File Structure", () => {
    it("should have year and month fields", () => {
      expect(contributorsData.year).toBe("2025");
      expect(contributorsData.month).toBe("11");
    });

    it("should have a summary object", () => {
      expect(contributorsData.summary).toBeDefined();
      expect(typeof contributorsData.summary).toBe("object");
    });

    it("should have a contributors array", () => {
      expect(contributorsData.contributors).toBeDefined();
      expect(Array.isArray(contributorsData.contributors)).toBe(true);
      expect(contributorsData.contributors.length).toBeGreaterThan(0);
    });

    it("should have generatedAt timestamp", () => {
      expect(contributorsData.generatedAt).toBeDefined();
      expect(typeof contributorsData.generatedAt).toBe("string");
      // Should be valid ISO date
      expect(() => new Date(contributorsData.generatedAt)).not.toThrow();
    });
  });

  describe("Summary Data", () => {
    it("should have required summary fields", () => {
      const { summary } = contributorsData;

      expect(summary.totalContributors).toBeDefined();
      expect(typeof summary.totalContributors).toBe("number");
      expect(summary.totalContributors).toBeGreaterThan(0);

      expect(summary.contributorsWithAddress).toBeDefined();
      expect(typeof summary.contributorsWithAddress).toBe("number");

      expect(summary.contributorsWithTokens).toBeDefined();
      expect(typeof summary.contributorsWithTokens).toBe("number");

      expect(summary.totalTokensIn).toBeDefined();
      expect(typeof summary.totalTokensIn).toBe("number");
      expect(summary.totalTokensIn).toBeGreaterThanOrEqual(0);

      expect(summary.totalTokensOut).toBeDefined();
      expect(typeof summary.totalTokensOut).toBe("number");
      expect(summary.totalTokensOut).toBeGreaterThanOrEqual(0);

      expect(summary.totalMessages).toBeDefined();
      expect(typeof summary.totalMessages).toBe("number");
      expect(summary.totalMessages).toBeGreaterThan(0);
    });

    it("should match totalContributors with contributors array length", () => {
      expect(contributorsData.summary.totalContributors).toBe(
        contributorsData.contributors.length
      );
    });

    it("should have consistent contributorsWithAddress count", () => {
      const contributorsWithAddress = contributorsData.contributors.filter(
        (c: any) => c.address !== null
      ).length;

      expect(contributorsData.summary.contributorsWithAddress).toBe(
        contributorsWithAddress
      );
    });

    it("should have consistent contributorsWithTokens count", () => {
      const contributorsWithTokens = contributorsData.contributors.filter(
        (c: any) => c.tokens.in > 0 || c.tokens.out > 0
      ).length;

      expect(contributorsData.summary.contributorsWithTokens).toBe(
        contributorsWithTokens
      );
    });

    it("should have correct totalTokensIn sum", () => {
      const calculatedTotal = contributorsData.contributors.reduce(
        (sum: number, c: any) => sum + (c.tokens.in || 0),
        0
      );

      // Allow small floating point differences
      expect(Math.abs(contributorsData.summary.totalTokensIn - calculatedTotal)).toBeLessThan(
        0.01
      );
    });

    it("should have correct totalTokensOut sum", () => {
      const calculatedTotal = contributorsData.contributors.reduce(
        (sum: number, c: any) => sum + (c.tokens.out || 0),
        0
      );

      // Allow small floating point differences
      expect(Math.abs(contributorsData.summary.totalTokensOut - calculatedTotal)).toBeLessThan(
        0.01
      );
    });

    it("should have correct totalMessages sum", () => {
      const calculatedTotal = contributorsData.contributors.reduce(
        (sum: number, c: any) => sum + (c.discord.messages || 0),
        0
      );

      expect(contributorsData.summary.totalMessages).toBe(calculatedTotal);
    });
  });

  describe("Contributor Data Structure", () => {
    let firstContributor: any;

    beforeAll(() => {
      firstContributor = contributorsData.contributors[0];
    });

    it("should have id field", () => {
      expect(firstContributor.id).toBeDefined();
      expect(typeof firstContributor.id).toBe("string");
      expect(firstContributor.id.length).toBeGreaterThan(0);
    });

    it("should have profile object with required fields", () => {
      expect(firstContributor.profile).toBeDefined();
      expect(typeof firstContributor.profile).toBe("object");

      expect(firstContributor.profile.name).toBeDefined();
      expect(typeof firstContributor.profile.name).toBe("string");

      expect(firstContributor.profile.username).toBeDefined();
      expect(typeof firstContributor.profile.username).toBe("string");

      // description can be null
      expect(firstContributor.profile).toHaveProperty("description");
      if (firstContributor.profile.description !== null) {
        expect(typeof firstContributor.profile.description).toBe("string");
      }

      // avatar_url can be null
      expect(firstContributor.profile).toHaveProperty("avatar_url");
      if (firstContributor.profile.avatar_url !== null) {
        expect(typeof firstContributor.profile.avatar_url).toBe("string");
        expect(firstContributor.profile.avatar_url).toMatch(/^https:\/\//);
      }

      // roles should be an array
      expect(firstContributor.profile).toHaveProperty("roles");
      expect(Array.isArray(firstContributor.profile.roles)).toBe(true);
    });

    it("should have tokens object with in and out fields", () => {
      expect(firstContributor.tokens).toBeDefined();
      expect(typeof firstContributor.tokens).toBe("object");

      expect(firstContributor.tokens).toHaveProperty("in");
      expect(typeof firstContributor.tokens.in).toBe("number");
      expect(firstContributor.tokens.in).toBeGreaterThanOrEqual(0);

      expect(firstContributor.tokens).toHaveProperty("out");
      expect(typeof firstContributor.tokens.out).toBe("number");
      expect(firstContributor.tokens.out).toBeGreaterThanOrEqual(0);
    });

    it("should have discord object with messages and mentions fields", () => {
      expect(firstContributor.discord).toBeDefined();
      expect(typeof firstContributor.discord).toBe("object");

      expect(firstContributor.discord).toHaveProperty("messages");
      expect(typeof firstContributor.discord.messages).toBe("number");
      expect(firstContributor.discord.messages).toBeGreaterThanOrEqual(0);

      expect(firstContributor.discord).toHaveProperty("mentions");
      expect(typeof firstContributor.discord.mentions).toBe("number");
      expect(firstContributor.discord.mentions).toBeGreaterThanOrEqual(0);
    });

    it("should have address field (nullable)", () => {
      expect(firstContributor).toHaveProperty("address");

      if (firstContributor.address !== null) {
        expect(typeof firstContributor.address).toBe("string");
        // Should be a valid Ethereum address
        expect(firstContributor.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      }
    });
  });

  describe("All Contributors Validation", () => {
    it("should have valid structure for all contributors", () => {
      for (const contributor of contributorsData.contributors) {
        // Required fields
        expect(contributor.id).toBeDefined();
        expect(contributor.profile).toBeDefined();
        expect(contributor.tokens).toBeDefined();
        expect(contributor.discord).toBeDefined();
        expect(contributor).toHaveProperty("address");

        // Profile fields
        expect(contributor.profile.name).toBeDefined();
        expect(contributor.profile.username).toBeDefined();
        expect(contributor.profile).toHaveProperty("description");
        expect(contributor.profile).toHaveProperty("avatar_url");
        expect(contributor.profile).toHaveProperty("roles");
        expect(Array.isArray(contributor.profile.roles)).toBe(true);

        // Token fields
        expect(typeof contributor.tokens.in).toBe("number");
        expect(typeof contributor.tokens.out).toBe("number");

        // Discord fields
        expect(typeof contributor.discord.messages).toBe("number");
        expect(typeof contributor.discord.mentions).toBe("number");
      }
    });

    it("should have no duplicate contributor IDs", () => {
      const ids = contributorsData.contributors.map((c: any) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should be sorted by tokens.in descending", () => {
      for (let i = 0; i < contributorsData.contributors.length - 1; i++) {
        const current = contributorsData.contributors[i];
        const next = contributorsData.contributors[i + 1];

        expect(current.tokens.in).toBeGreaterThanOrEqual(next.tokens.in);
      }
    });
  });

  describe("Data Quality", () => {
    it("should have contributors with Discord activity", () => {
      const contributorsWithMessages = contributorsData.contributors.filter(
        (c: any) => c.discord.messages > 0
      );

      expect(contributorsWithMessages.length).toBeGreaterThan(0);
    });

    it("should have contributors with token activity", () => {
      const contributorsWithTokens = contributorsData.contributors.filter(
        (c: any) => c.tokens.in > 0 || c.tokens.out > 0
      );

      // November 2025 should have some token activity
      expect(contributorsWithTokens.length).toBeGreaterThan(0);
    });

    it("should have contributors with wallet addresses", () => {
      const contributorsWithAddresses = contributorsData.contributors.filter(
        (c: any) => c.address !== null
      );

      expect(contributorsWithAddresses.length).toBeGreaterThan(0);
    });

    it("should have valid avatar URLs when present", () => {
      const contributorsWithAvatars = contributorsData.contributors.filter(
        (c: any) => c.profile.avatar_url !== null
      );

      for (const contributor of contributorsWithAvatars) {
        expect(contributor.profile.avatar_url).toMatch(
          /^https:\/\/cdn\.discordapp\.com\/avatars\//
        );
      }
    });

    it("should have consistent data between tokens and address", () => {
      // Contributors with tokens should have addresses
      const contributorsWithTokens = contributorsData.contributors.filter(
        (c: any) => c.tokens.in > 0 || c.tokens.out > 0
      );

      for (const contributor of contributorsWithTokens) {
        expect(contributor.address).not.toBeNull();
        expect(contributor.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      }
    });

    it("should have valid roles when present", () => {
      const contributorsWithRoles = contributorsData.contributors.filter(
        (c: any) => c.profile.roles && c.profile.roles.length > 0
      );

      // Should have at least some contributors with roles
      expect(contributorsWithRoles.length).toBeGreaterThan(0);

      for (const contributor of contributorsWithRoles) {
        // All roles should be non-empty strings
        for (const role of contributor.profile.roles) {
          expect(typeof role).toBe("string");
          expect(role.length).toBeGreaterThan(0);
          // Should not be @everyone
          expect(role).not.toBe("@everyone");
        }
      }
    });
  });

  describe("November 2025 Specific Checks", () => {
    it("should have realistic token amounts", () => {
      const totalTokensIn = contributorsData.summary.totalTokensIn;

      // November 2025 was an active month
      expect(totalTokensIn).toBeGreaterThan(0);
      expect(totalTokensIn).toBeLessThan(10000); // Sanity check
    });

    it("should have realistic message counts", () => {
      const totalMessages = contributorsData.summary.totalMessages;

      // November 2025 should have significant activity
      expect(totalMessages).toBeGreaterThan(10);
      expect(totalMessages).toBeLessThan(10000); // Sanity check
    });

    it("should have multiple contributors", () => {
      // November 2025 should have a good number of contributors
      expect(contributorsData.contributors.length).toBeGreaterThan(5);
    });
  });
});
