/**
 * Tests for contributors data structure
 * Validates the structure and content of contributors.json files
 * 
 * Uses test fixtures from tests/data/ if available,
 * otherwise gracefully skips tests.
 */

import * as fs from "fs";
import * as path from "path";
import { describe, test, expect, beforeAll } from "@jest/globals";
import type { ContributorsFile } from "../src/types/contributors";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "tests/data");

// Find the most recent month with contributors data
function findLatestContributorsFile(): string | null {
  if (!fs.existsSync(DATA_DIR)) return null;

  const years = fs.readdirSync(DATA_DIR)
    .filter(d => /^\d{4}$/.test(d))
    .sort()
    .reverse();

  for (const year of years) {
    const yearPath = path.join(DATA_DIR, year);
    if (!fs.statSync(yearPath).isDirectory()) continue;

    const months = fs.readdirSync(yearPath)
      .filter(d => /^\d{2}$/.test(d))
      .sort()
      .reverse();

    for (const month of months) {
      const contribPath = path.join(DATA_DIR, year, month, "contributors.json");
      if (fs.existsSync(contribPath)) {
        return contribPath;
      }
    }
  }
  return null;
}

describe("Contributors Data Structure", () => {
  let contributorsPath: string | null;
  let contributorsData: ContributorsFile | null = null;

  beforeAll(() => {
    contributorsPath = findLatestContributorsFile();
    if (contributorsPath) {
      try {
        const content = fs.readFileSync(contributorsPath, "utf-8");
        contributorsData = JSON.parse(content);
        console.log(`Testing contributors from: ${contributorsPath}`);
      } catch (e) {
        console.warn(`Failed to parse contributors file: ${e}`);
      }
    } else {
      console.warn("⚠️ No contributors.json found in DATA_DIR. Skipping structure tests.");
    }
  });

  test("contributors file exists (or is skipped)", () => {
    if (!contributorsPath) {
      console.log("Skipping - no data available");
      return;
    }
    expect(fs.existsSync(contributorsPath)).toBe(true);
  });

  test("has valid root structure", () => {
    if (!contributorsData) return;

    expect(contributorsData).toHaveProperty("year");
    expect(contributorsData).toHaveProperty("month");
    expect(contributorsData).toHaveProperty("summary");
    expect(contributorsData).toHaveProperty("contributors");
    expect(Array.isArray(contributorsData.contributors)).toBe(true);
  });

  test("contributors have required profile fields", () => {
    if (!contributorsData) return;

    for (const contributor of contributorsData.contributors.slice(0, 10)) {
      expect(contributor).toHaveProperty("profile");
      expect(contributor.profile).toHaveProperty("name");
      expect(contributor.profile).toHaveProperty("username");
    }
  });

  test("contributors have token fields", () => {
    if (!contributorsData) return;

    for (const contributor of contributorsData.contributors.slice(0, 10)) {
      expect(contributor).toHaveProperty("tokens");
      expect(contributor.tokens).toHaveProperty("in");
      expect(contributor.tokens).toHaveProperty("out");
      expect(typeof contributor.tokens.in).toBe("number");
      expect(typeof contributor.tokens.out).toBe("number");
    }
  });

  test("token values are non-negative", () => {
    if (!contributorsData) return;

    for (const contributor of contributorsData.contributors) {
      expect(contributor.tokens.in).toBeGreaterThanOrEqual(0);
      expect(contributor.tokens.out).toBeGreaterThanOrEqual(0);
    }
  });

  test("contributors are sorted by tokens received (descending)", () => {
    if (!contributorsData) return;

    const withTokens = contributorsData.contributors.filter(c => c.tokens.in > 0);
    for (let i = 0; i < withTokens.length - 1; i++) {
      expect(withTokens[i].tokens.in).toBeGreaterThanOrEqual(withTokens[i + 1].tokens.in);
    }
  });

  test("summary totalContributors matches array length", () => {
    if (!contributorsData) return;

    expect(contributorsData.summary.totalContributors).toBe(
      contributorsData.contributors.length
    );
  });

  test("summary token totals match calculated totals", () => {
    if (!contributorsData) return;

    const calcIn = contributorsData.contributors.reduce(
      (sum, c) => sum + c.tokens.in,
      0
    );
    const calcOut = contributorsData.contributors.reduce(
      (sum, c) => sum + c.tokens.out,
      0
    );

    expect(contributorsData.summary.totalTokensIn).toBeCloseTo(calcIn, 2);
    expect(contributorsData.summary.totalTokensOut).toBeCloseTo(calcOut, 2);
  });
});
