/**
 * Tests for contributors data generation
 * Validates the structure and content of data/{year}/{month}/contributors.json
 */

import * as fs from "fs";
import * as path from "path";
import type { ContributorsFile } from "../src/types/contributors";

const TEST_YEAR = "2025";
const TEST_MONTH = "11";
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "tests/data");

describe("Contributors Data", () => {
  const contributorsPath = path.join(DATA_DIR, TEST_YEAR, TEST_MONTH, "contributors.json");

  test("contributors file exists and has valid structure", () => {
    expect(fs.existsSync(contributorsPath)).toBe(true);

    const content = fs.readFileSync(contributorsPath, "utf-8");
    const data: ContributorsFile = JSON.parse(content);

    // Check root structure
    expect(data).toHaveProperty("year");
    expect(data).toHaveProperty("month");
    expect(data).toHaveProperty("summary");
    expect(data).toHaveProperty("contributors");
    expect(Array.isArray(data.contributors)).toBe(true);
    expect(data.contributors.length).toBeGreaterThan(0);
  });

  test("includes xdamman as a contributor", () => {
    const content = fs.readFileSync(contributorsPath, "utf-8");
    const data: ContributorsFile = JSON.parse(content);

    const xdamman = data.contributors.find(
      (c) => c.profile.username === "xdamman"
    );

    expect(xdamman).toBeDefined();
    expect(xdamman?.profile.name).toBe("Xavier");
  });

  test("contributors are sorted by tokens received (tokens.in)", () => {
    const content = fs.readFileSync(contributorsPath, "utf-8");
    const data: ContributorsFile = JSON.parse(content);

    // Get contributors with tokens received
    const contributorsWithTokens = data.contributors.filter(
      (c) => c.tokens.in > 0
    );

    // Check that they're sorted descending by tokens.in (tokens received)
    for (let i = 0; i < contributorsWithTokens.length - 1; i++) {
      expect(contributorsWithTokens[i].tokens.in).toBeGreaterThanOrEqual(
        contributorsWithTokens[i + 1].tokens.in
      );
    }
  });

  test("all contributors have required fields", () => {
    const content = fs.readFileSync(contributorsPath, "utf-8");
    const data: ContributorsFile = JSON.parse(content);

    data.contributors.forEach((contributor) => {
      // Profile fields
      expect(contributor.profile).toHaveProperty("name");
      expect(contributor.profile).toHaveProperty("username");
      expect(contributor.profile).toHaveProperty("avatar_url");
      expect(contributor.profile).toHaveProperty("roles");
      expect(Array.isArray(contributor.profile.roles)).toBe(true);

      // Token fields
      expect(contributor.tokens).toHaveProperty("in");
      expect(contributor.tokens).toHaveProperty("out");
      expect(typeof contributor.tokens.in).toBe("number");
      expect(typeof contributor.tokens.out).toBe("number");

      // Discord fields
      expect(contributor.discord).toHaveProperty("messages");
      expect(contributor.discord).toHaveProperty("mentions");
      expect(typeof contributor.discord.messages).toBe("number");
      expect(typeof contributor.discord.mentions).toBe("number");

      // Address field
      expect(contributor).toHaveProperty("address");
    });
  });

  test("contributors have valid token fields", () => {
    const content = fs.readFileSync(contributorsPath, "utf-8");
    const data: ContributorsFile = JSON.parse(content);

    // All contributors should have token fields with numeric values
    data.contributors.forEach((contributor) => {
      expect(contributor.tokens.in).toBeGreaterThanOrEqual(0);
      expect(contributor.tokens.out).toBeGreaterThanOrEqual(0);
      expect(typeof contributor.tokens.in).toBe("number");
      expect(typeof contributor.tokens.out).toBe("number");
    });
  });

  test("summary matches contributors data", () => {
    const content = fs.readFileSync(contributorsPath, "utf-8");
    const data: ContributorsFile = JSON.parse(content);

    // Check summary totals
    expect(data.summary.totalContributors).toBe(data.contributors.length);

    const contributorsWithAddress = data.contributors.filter(
      (c) => c.address && c.address.length > 0
    ).length;
    expect(data.summary.contributorsWithAddress).toBe(contributorsWithAddress);

    const contributorsWithTokens = data.contributors.filter(
      (c) => c.tokens.in > 0 || c.tokens.out > 0
    ).length;
    expect(data.summary.contributorsWithTokens).toBe(contributorsWithTokens);

    const totalTokensIn = data.contributors.reduce(
      (sum, c) => sum + c.tokens.in,
      0
    );
    expect(data.summary.totalTokensIn).toBe(totalTokensIn);

    const totalTokensOut = data.contributors.reduce(
      (sum, c) => sum + c.tokens.out,
      0
    );
    expect(data.summary.totalTokensOut).toBe(totalTokensOut);

    const totalMessages = data.contributors.reduce(
      (sum, c) => sum + c.discord.messages,
      0
    );
    expect(data.summary.totalMessages).toBe(totalMessages);
  });
});
