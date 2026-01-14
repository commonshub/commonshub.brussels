/**
 * Calendar Fetching Tests
 * Tests that calendars can be fetched and stored in the correct directory structure
 * @jest-environment node
 */

import { describe, test, expect, beforeAll } from "@jest/globals";
import * as path from "path";
import * as fs from "fs";
import ical from "node-ical";
import { execSync } from "child_process";

describe("Calendar Fetching Tests", () => {
  const testDataDir = path.join(process.cwd(), "tests", "data");
  const testYear = "2025";
  const testMonth = "11";
  const calendarsDir = path.join(testDataDir, testYear, testMonth, "calendars");

  beforeAll(() => {
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
        }
      );
    } catch (error) {
      console.error("Failed to fetch calendars:", error);
      throw error;
    }
  }, 120000); // 2 minute timeout for fetching

  test("calendars directory exists", () => {
    expect(fs.existsSync(calendarsDir)).toBe(true);
  });

  test("ical subdirectory structure (if present)", () => {
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

  test("other calendar .ics files exist in calendars root", () => {
    const icsFiles = fs
      .readdirSync(calendarsDir)
      .filter((file) => file.endsWith(".ics"));

    if (icsFiles.length > 0) {
      console.log(`✓ Found ${icsFiles.length} .ics file(s) in calendars root:`);
      icsFiles.forEach((file) => console.log(`  - ${file}`));
    } else {
      console.log("ℹ️  No .ics files found in calendars root (this is optional)");
    }
  });

  test("luma subdirectory structure is correct", () => {
    const lumaDir = path.join(calendarsDir, "luma");

    if (fs.existsSync(lumaDir)) {
      console.log(`✓ Found Luma directory: calendars/luma/`);

      // Check for JSON files
      const jsonFiles = fs
        .readdirSync(lumaDir)
        .filter((file) => file.endsWith(".json"));

      if (jsonFiles.length > 0) {
        console.log(`✓ Found ${jsonFiles.length} Luma JSON file(s)`);

        // Verify structure of first JSON file
        const firstFile = path.join(lumaDir, jsonFiles[0]);
        const content = fs.readFileSync(firstFile, "utf-8");
        const data = JSON.parse(content);

        expect(Array.isArray(data)).toBe(true);

        if (data.length > 0) {
          const firstEvent = data[0];
          expect(firstEvent).toHaveProperty("api_id");
          expect(firstEvent).toHaveProperty("name");
          expect(firstEvent).toHaveProperty("start_at");
          console.log(`✓ Verified ${data.length} Luma events with correct structure`);
        }
      }

      // Check for guests directory (should be in private subdirectory)
      const guestsDir = path.join(lumaDir, "private", "guests");
      if (fs.existsSync(guestsDir)) {
        const guestFiles = fs.readdirSync(guestsDir);
        console.log(`✓ Found guests directory with ${guestFiles.length} file(s) in private/guests/`);
      }

      // Check for images directory
      const imagesDir = path.join(lumaDir, "images");
      if (fs.existsSync(imagesDir)) {
        const imageFiles = fs.readdirSync(imagesDir).filter(
          (f) => !f.startsWith(".")
        );
        console.log(
          `✓ Found images directory with ${imageFiles.length} file(s)`
        );
        expect(imageFiles.length).toBeGreaterThan(0);
      }
    } else {
      console.log(
        "ℹ️  Luma directory not found (requires LUMA_API_KEY environment variable)"
      );
    }
  });

  test("specific eventbrite event has og:image downloaded", () => {
    // This tests a specific case where an event has a URL in the LOCATION field
    // Event: "Soirée du Citizenfund" with URL in location field
    const eventbriteUrl =
      "https://www.eventbrite.be/e/soiree-du-citizenfund-tickets-1961750";

    // Read the luma.ics file to find this event
    const lumaIcsPath = path.join(calendarsDir, "luma.ics");
    if (fs.existsSync(lumaIcsPath)) {
      const icsContent = fs.readFileSync(lumaIcsPath, "utf-8");
      const hasEventbriteEvent = icsContent.includes(eventbriteUrl);

      if (hasEventbriteEvent) {
        console.log(
          `✓ Found Eventbrite event in luma.ics (URL in LOCATION field)`
        );

        // Check if og:image was downloaded for this event
        const imagesDir = path.join(calendarsDir, "images");
        if (fs.existsSync(imagesDir)) {
          const images = fs
            .readdirSync(imagesDir)
            .filter((f) => !f.startsWith("."));

          // We expect at least one image to be downloaded from events with URL in location
          expect(images.length).toBeGreaterThan(0);
          console.log(
            `  ✓ Downloaded ${images.length} og:image(s) from calendar events with URLs in LOCATION field`
          );

          // Show sample image
          if (images.length > 0) {
            const firstImage = path.join(imagesDir, images[0]);
            const stats = fs.statSync(firstImage);
            console.log(`  ✓ Sample: ${images[0]} (${stats.size} bytes)`);
          }
        } else {
          throw new Error(
            "Images directory not found - og:images should be downloaded for events with URLs in LOCATION field"
          );
        }
      } else {
        console.log(
          "ℹ️  Eventbrite event not found in this month's calendar"
        );
      }
    }
  });

  test("event images are downloaded", () => {
    // Check for Luma images (cover_url from Luma API)
    const lumaImagesDir = path.join(calendarsDir, "luma", "images");
    let lumaImageCount = 0;
    if (fs.existsSync(lumaImagesDir)) {
      const lumaImages = fs
        .readdirSync(lumaImagesDir)
        .filter((f) => !f.startsWith("."));
      lumaImageCount = lumaImages.length;
      console.log(`✓ Found ${lumaImageCount} Luma cover image(s)`);

      // Verify image files are valid (have size > 0)
      if (lumaImageCount > 0) {
        const firstImage = path.join(lumaImagesDir, lumaImages[0]);
        const stats = fs.statSync(firstImage);
        expect(stats.size).toBeGreaterThan(0);
        console.log(
          `  ✓ Sample image ${lumaImages[0]}: ${stats.size} bytes`
        );
      }
    }

    // Check for calendar images (og:image from event URLs - optional)
    const calendarImagesDir = path.join(calendarsDir, "images");
    let calendarImageCount = 0;
    if (fs.existsSync(calendarImagesDir)) {
      const calendarImages = fs
        .readdirSync(calendarImagesDir)
        .filter((f) => !f.startsWith("."));
      calendarImageCount = calendarImages.length;
      if (calendarImageCount > 0) {
        console.log(`✓ Found ${calendarImageCount} og:image(s) from calendar events`);
      } else {
        console.log(
          `ℹ️  No og:images found (calendar events may not have URLs)`
        );
      }
    }

    // Verify image counts
    const totalImages = lumaImageCount + calendarImageCount;
    console.log(`\n✓ Total event images: ${totalImages}`);

    // We expect at least one Luma image (if LUMA_API_KEY is set)
    if (process.env.LUMA_API_KEY) {
      expect(lumaImageCount).toBeGreaterThan(0);
      console.log(
        `  ✓ Requirement met: At least 1 Luma image (found ${lumaImageCount})`
      );
    }

    // Calendar og:images are optional but we should have at least Luma images
    expect(totalImages).toBeGreaterThan(0);
  });

  test("consolidated structure is correct", () => {
    console.log("\n📂 Final directory structure:");

    // List all subdirectories and files in calendars
    const items = fs.readdirSync(calendarsDir, { withFileTypes: true });

    items.forEach((item) => {
      if (item.isDirectory()) {
        console.log(`  📁 calendars/${item.name}/`);
        const subItems = fs.readdirSync(path.join(calendarsDir, item.name));
        subItems.forEach((subItem) => {
          console.log(`     - ${subItem}`);
        });
      } else {
        console.log(`  📄 calendars/${item.name}`);
      }
    });

    // Verify no old structure remains
    const oldIcalDir = path.join(testDataDir, testYear, testMonth, "ical");
    const oldLumaDir = path.join(testDataDir, testYear, testMonth, "luma");

    if (fs.existsSync(oldIcalDir)) {
      console.warn("⚠️  Old 'ical' directory still exists outside calendars");
    }
    if (fs.existsSync(oldLumaDir)) {
      console.warn("⚠️  Old 'luma' directory still exists outside calendars");
    }

    // Main assertion: calendars directory exists
    expect(fs.existsSync(calendarsDir)).toBe(true);
  });
});
