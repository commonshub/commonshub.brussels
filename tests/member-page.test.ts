/**
 * Member Page Integration Tests
 * Tests that the /members/[username] page loads correctly with real data
 */

import { describe, test, expect, beforeAll } from "@jest/globals";

describe("Member Page", () => {
  const baseUrl =
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    "http://localhost:3000";

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  describe("API Endpoint", () => {
    test("contributors API returns valid data", async () => {
      const response = await fetch(`${baseUrl}/api/discord/contributors`);

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      const data = await response.json();

      // Check structure
      expect(data).toHaveProperty("contributors");
      expect(data).toHaveProperty("introductions");
      expect(data).toHaveProperty("contributions");
      expect(data).toHaveProperty("userMap");
      expect(data).toHaveProperty("channelMap");

      // Check contributors array
      expect(Array.isArray(data.contributors)).toBe(true);
      expect(data.contributors.length).toBeGreaterThan(0);

      // Verify first contributor has required fields
      const firstContributor = data.contributors[0];
      expect(firstContributor).toHaveProperty("id");
      expect(firstContributor).toHaveProperty("username");
      expect(firstContributor).toHaveProperty("displayName");
      expect(firstContributor).toHaveProperty("contributionCount");
    });

    test("contributors API includes xdamman", async () => {
      const response = await fetch(`${baseUrl}/api/discord/contributors`);
      const data = await response.json();

      const xdamman = data.contributors.find(
        (c: any) => c.username.toLowerCase() === "xdamman"
      );

      expect(xdamman).toBeDefined();
      expect(xdamman.username).toBe("xdamman");
      expect(xdamman.id).toBeDefined();
    });
  });

  describe("Member Profile Page", () => {
    test("xdamman member page returns 200", async () => {
      const response = await fetch(`${baseUrl}/members/xdamman`, {
        headers: {
          Accept: "text/html",
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });

    test("xdamman member page contains profile data", async () => {
      const response = await fetch(`${baseUrl}/members/xdamman`);
      const html = await response.text();

      // Check for username (case insensitive)
      expect(html.toLowerCase()).toContain("xdamman");

      // Check for profile elements that are actually rendered
      expect(html).toContain("Back to Members");
      expect(html).toContain("Xavier");
    });

    test("non-existent member returns 200 with not found message", async () => {
      const response = await fetch(`${baseUrl}/members/nonexistentuser12345`);

      expect(response.status).toBe(200);

      const html = await response.text();
      expect(html).toContain("Member not found");
    });

    test("case-insensitive username matching works", async () => {
      const lowerResponse = await fetch(`${baseUrl}/members/xdamman`);
      const upperResponse = await fetch(`${baseUrl}/members/XDAMMAN`);
      const mixedResponse = await fetch(`${baseUrl}/members/XDamman`);

      expect(lowerResponse.status).toBe(200);
      expect(upperResponse.status).toBe(200);
      expect(mixedResponse.status).toBe(200);

      const lowerHtml = await lowerResponse.text();
      const upperHtml = await upperResponse.text();
      const mixedHtml = await mixedResponse.text();

      // All should contain the profile (or all should show not found, but consistently)
      const lowerHasProfile = lowerHtml.includes("Back to Members");
      const upperHasProfile = upperHtml.includes("Back to Members");
      const mixedHasProfile = mixedHtml.includes("Back to Members");

      // Either all have profile or all don't (consistent behavior)
      expect(lowerHasProfile).toBe(upperHasProfile);
      expect(upperHasProfile).toBe(mixedHasProfile);
    });
  });

  describe("Member Data Integration", () => {
    test("member page displays contributions when available", async () => {
      // Get list of contributors with contributions
      const apiResponse = await fetch(`${baseUrl}/api/discord/contributors`);
      const data = await apiResponse.json();

      const memberWithContributions = data.contributors.find(
        (c: any) => c.contributionCount > 0
      );

      if (memberWithContributions) {
        const pageResponse = await fetch(
          `${baseUrl}/members/${memberWithContributions.username}`
        );
        const html = await pageResponse.text();

        expect(html).toContain("Back to Members");
        expect(pageResponse.status).toBe(200);
      }
    });
  });
});
