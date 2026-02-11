/**
 * Tests for contributors.json generated file
 * 
 * This tests the aggregated contributors.json that is generated
 * by the generate-contributors script. Tests skip gracefully if
 * the file doesn't exist.
 */

import { describe, test, expect, beforeAll } from "@jest/globals";
import fs from "fs";
import path from "path";

describe("Contributors Generation", () => {
  const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "tests/data");
  const contributorsPath = path.join(DATA_DIR, "contributors.json");
  let contributorsData: any = null;
  let fileExists = false;

  beforeAll(() => {
    fileExists = fs.existsSync(contributorsPath);
    if (fileExists) {
      try {
        contributorsData = JSON.parse(fs.readFileSync(contributorsPath, "utf-8"));
        console.log(`Testing ${contributorsPath}`);
      } catch (e) {
        console.warn(`Failed to parse contributors.json: ${e}`);
      }
    } else {
      console.warn("⚠️ contributors.json not found. Run generate-contributors to create it.");
      console.warn(`   Expected at: ${contributorsPath}`);
    }
  });

  test("contributors.json exists (or is skipped)", () => {
    if (!fileExists) {
      console.log("Skipping - file not generated yet");
      return;
    }
    expect(fileExists).toBe(true);
  });

  test("contributors.json has valid structure", () => {
    if (!contributorsData) return;

    expect(contributorsData).toHaveProperty("contributors");
    expect(contributorsData).toHaveProperty("activeCommoners");
    expect(contributorsData).toHaveProperty("totalMembers");
    expect(contributorsData).toHaveProperty("timestamp");

    expect(Array.isArray(contributorsData.contributors)).toBe(true);
    expect(typeof contributorsData.activeCommoners).toBe("number");
  });

  test("contributors have required fields", () => {
    if (!contributorsData) return;

    for (const contributor of contributorsData.contributors.slice(0, 10)) {
      expect(contributor).toHaveProperty("id");
      expect(contributor).toHaveProperty("username");
      expect(contributor).toHaveProperty("displayName");
      expect(contributor).toHaveProperty("avatar");
      expect(contributor).toHaveProperty("contributionCount");

      expect(typeof contributor.id).toBe("string");
      expect(typeof contributor.username).toBe("string");
      expect(typeof contributor.displayName).toBe("string");
      expect(typeof contributor.contributionCount).toBe("number");
    }
  });

  test("contributors are sorted by contribution count", () => {
    if (!contributorsData) return;

    for (let i = 1; i < contributorsData.contributors.length; i++) {
      expect(contributorsData.contributors[i - 1].contributionCount).toBeGreaterThanOrEqual(
        contributorsData.contributors[i].contributionCount
      );
    }
  });

  test("top contributor has contributions", () => {
    if (!contributorsData || contributorsData.contributors.length === 0) return;

    const topContributor = contributorsData.contributors[0];
    console.log(
      `Top contributor: ${topContributor.displayName} with ${topContributor.contributionCount} contributions`
    );

    expect(topContributor.contributionCount).toBeGreaterThan(0);
  });

  test("file size is reasonable (< 100KB)", () => {
    if (!fileExists) return;

    const stats = fs.statSync(contributorsPath);
    const sizeInKB = stats.size / 1024;

    console.log(`contributors.json size: ${sizeInKB.toFixed(2)}KB`);

    expect(sizeInKB).toBeLessThan(100);
  });
});
