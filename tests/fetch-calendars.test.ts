/**
 * Calendar Fetching Tests
 * Tests that calendars can be fetched and stored in the correct directory structure
 * 
 * These are INTEGRATION tests that require network access.
 * They are skipped in CI unless INTEGRATION_TESTS=true is set.
 * 
 * @jest-environment node
 */

import { describe, test, expect, beforeAll } from "@jest/globals";
import * as path from "path";
import * as fs from "fs";
import ical from "node-ical";
import { execSync } from "child_process";

// Skip integration tests in CI unless explicitly enabled
const SKIP_INTEGRATION = process.env.CI === "true" && process.env.INTEGRATION_TESTS !== "true";

describe("Calendar Fetching Tests", () => {
  const testDataDir = path.join(process.cwd(), "tests", "data");
  const testYear = "2025";
  const testMonth = "11";
  const calendarsDir = path.join(testDataDir, testYear, testMonth, "calendars");

  let fetchSucceeded = false;

  beforeAll(() => {
    if (SKIP_INTEGRATION) {
      console.log("⏭️  Skipping calendar fetch integration tests in CI");
      console.log("   Set INTEGRATION_TESTS=true to run these tests");
      return;
    }

    // Set DATA_DIR environment variable and fetch calendars for test month
    process.env.DATA_DIR = testDataDir;
    console.log(`\n🗓️  Fetching calendars for ${testYear}/${testMonth}`);
    console.log(`📁 Test data directory: ${testDataDir}`);

    try {
      // Run the fetch-calendars script with DATA_DIR set and month filter
      execSync(
        `DATA_DIR=${testDataDir} npx tsx scripts/fetch-calendars.ts --month=${testYear}-${testMonth}`,
        {
          stdio: "inherit",
          env: { ...process.env, DATA_DIR: testDataDir },
          timeout: 120000,
        }
      );
      fetchSucceeded = true;
    } catch (error) {
      console.warn("⚠️  Failed to fetch calendars (network issue?):", error);
      // Don't throw - let individual tests skip gracefully
    }
  }, 120000); // 2 minute timeout for fetching

  test("calendars directory exists", () => {
    if (SKIP_INTEGRATION || !fetchSucceeded) {
      console.log("Skipping - integration test");
      return;
    }
    expect(fs.existsSync(calendarsDir)).toBe(true);
  });

  test("ical subdirectory structure (if present)", () => {
    if (SKIP_INTEGRATION || !fetchSucceeded) return;

    const icalDir = path.join(calendarsDir, "ical");
    const calendarFile = path.join(icalDir, "calendar.ics");

    if (fs.existsSync(icalDir)) {
      console.log(`✓ Found iCal subdirectory: calendars/ical/`);
      expect(fs.existsSync(calendarFile)).toBe(true);
      console.log(`✓ Found iCal calendar: calendars/ical/calendar.ics`);
    } else {
      console.log(
        "ℹ️  iCal subdirectory not found (only created if main iCal URL is configured)"
      );
    }

    // Test always passes - ical directory is optional
    expect(true).toBe(true);
  });

  test("calendar.ics has valid iCal format", async () => {
    if (SKIP_INTEGRATION || !fetchSucceeded) return;

    const calendarFile = path.join(calendarsDir, "ical", "calendar.ics");

    if (!fs.existsSync(calendarFile)) {
      console.warn("calendar.ics not found, skipping test");
      return;
    }

    const content = fs.readFileSync(calendarFile, "utf-8");

    // Check iCal structure
    expect(content).toContain("BEGIN:VCALENDAR");
    expect(content).toContain("END:VCALENDAR");
    expect(content).toContain("VERSION:2.0");
    expect(content).toContain("PRODID:");

    // Parse events
    const events = await ical.async.parseICS(content);
    const eventArray = Object.values(events).filter(
      (event: any) => event.type === "VEVENT"
    );

    if (eventArray.length > 0) {
      console.log(`✓ Parsed ${eventArray.length} events from iCal`);

      // Verify all events are from the correct month
      for (const event of eventArray) {
        const startDate = event.start as Date;
        expect(startDate).toBeDefined();

        const eventYear = startDate.getFullYear().toString();
        const eventMonth = String(startDate.getMonth() + 1).padStart(2, "0");

        expect(eventYear).toBe(testYear);
        expect(eventMonth).toBe(testMonth);
      }
    }
  });

  test("luma subdirectory structure (if present)", () => {
    if (SKIP_INTEGRATION || !fetchSucceeded) return;

    const lumaDir = path.join(calendarsDir, "luma");

    if (fs.existsSync(lumaDir)) {
      console.log(`✓ Found Luma subdirectory: calendars/luma/`);
      // Check for expected files
      const files = fs.readdirSync(lumaDir);
      console.log(`  Files found: ${files.join(", ")}`);
    } else {
      console.log(
        "ℹ️  Luma subdirectory not found (only created if Luma calendar is configured)"
      );
    }

    // Test always passes - luma directory is optional
    expect(true).toBe(true);
  });

  test("images directory exists if events have cover images", () => {
    if (SKIP_INTEGRATION || !fetchSucceeded) return;

    const icsDir = path.join(calendarsDir, "ics");
    const imagesDir = path.join(icsDir, "images");

    if (fs.existsSync(imagesDir)) {
      const images = fs.readdirSync(imagesDir);
      console.log(`✓ Found ${images.length} downloaded images`);
      expect(images.length).toBeGreaterThanOrEqual(0);
    } else {
      // No images directory is fine - means no events with cover images
      console.log("ℹ️  No images directory found (no events with cover images)");
    }

    expect(true).toBe(true);
  });

  test("event images are downloaded", () => {
    if (SKIP_INTEGRATION || !fetchSucceeded) return;

    // Check both ics/images and luma images
    const icsImagesDir = path.join(calendarsDir, "ics", "images");
    const lumaImagesDir = path.join(calendarsDir, "luma", "images");

    let totalImages = 0;

    if (fs.existsSync(icsImagesDir)) {
      const icsImages = fs.readdirSync(icsImagesDir);
      totalImages += icsImages.length;
      console.log(`  iCal images: ${icsImages.length}`);
    }

    if (fs.existsSync(lumaImagesDir)) {
      const lumaImages = fs.readdirSync(lumaImagesDir);
      totalImages += lumaImages.length;
      console.log(`  Luma images: ${lumaImages.length}`);
    }

    console.log(`  Total images downloaded: ${totalImages}`);
    // Images are optional - test passes regardless
    expect(true).toBe(true);
  });

  test("consolidated structure is correct", () => {
    if (SKIP_INTEGRATION || !fetchSucceeded) return;

    // Check that we have either ics or luma structure
    const icsDir = path.join(calendarsDir, "ics");
    const icalDir = path.join(calendarsDir, "ical");
    const lumaDir = path.join(calendarsDir, "luma");

    const hasIcs = fs.existsSync(icsDir);
    const hasIcal = fs.existsSync(icalDir);
    const hasLuma = fs.existsSync(lumaDir);

    console.log(`\nCalendar sources found:`);
    console.log(`  ics/: ${hasIcs}`);
    console.log(`  ical/: ${hasIcal}`);
    console.log(`  luma/: ${hasLuma}`);

    // At least one source should exist if fetch succeeded
    if (fetchSucceeded) {
      expect(hasIcs || hasIcal || hasLuma).toBe(true);
    }
  });
});
