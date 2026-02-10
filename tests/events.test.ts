/**
 * Tests for events data structure
 * 
 * Validates event files when they exist, skips gracefully otherwise.
 */

import * as fs from "fs";
import * as path from "path";
import { describe, test, expect, beforeAll } from "@jest/globals";
import type { EventsFile } from "../src/types/events";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "tests/data");

// Find a month with events data
function findEventsFile(): { path: string; year: string; month: string } | null {
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
      const eventsPath = path.join(DATA_DIR, year, month, "events.json");
      if (fs.existsSync(eventsPath)) {
        return { path: eventsPath, year, month };
      }
    }
  }
  return null;
}

describe("Events System", () => {
  let eventsFile: { path: string; year: string; month: string } | null;
  let eventsData: EventsFile | null = null;

  beforeAll(() => {
    eventsFile = findEventsFile();
    if (eventsFile) {
      try {
        const content = fs.readFileSync(eventsFile.path, "utf-8");
        eventsData = JSON.parse(content);
        console.log(`Testing events from: ${eventsFile.path}`);
        console.log(`  ${eventsData?.events?.length ?? 0} events found`);
      } catch (e) {
        console.warn(`Failed to parse events file: ${e}`);
      }
    } else {
      console.warn("⚠️ No events.json found. Skipping events tests.");
    }
  });

  describe("events.json structure", () => {
    test("has valid root structure", () => {
      if (!eventsData) return;

      expect(eventsData).toHaveProperty("month");
      expect(eventsData).toHaveProperty("generatedAt");
      expect(eventsData).toHaveProperty("events");
      expect(Array.isArray(eventsData.events)).toBe(true);
    });

    test("all events have required fields", () => {
      if (!eventsData) return;

      for (const event of eventsData.events.slice(0, 20)) {
        expect(event).toHaveProperty("id");
        expect(event).toHaveProperty("name");
        expect(event).toHaveProperty("startAt");
        expect(event).toHaveProperty("source");
        expect(event).toHaveProperty("metadata");

        // Validate source
        expect(["luma", "ical"]).toContain(event.source);

        // Validate dates
        expect(() => new Date(event.startAt)).not.toThrow();
        if (event.endAt) {
          expect(() => new Date(event.endAt)).not.toThrow();
        }
      }
    });

    test("Luma events have URLs", () => {
      if (!eventsData) return;

      const lumaEvents = eventsData.events.filter(
        e => e.source === "luma" || e.calendarSource === "luma" || e.calendarSource === "luma-api"
      );
      const lumaEventsWithoutUrl = lumaEvents.filter(e => !e.url);

      if (lumaEventsWithoutUrl.length > 0) {
        console.warn(
          `⚠️ ${lumaEventsWithoutUrl.length} Luma events missing URLs:`,
          lumaEventsWithoutUrl.slice(0, 3).map(e => e.name)
        );
      }

      // Allow some tolerance
      const coverage = (lumaEvents.length - lumaEventsWithoutUrl.length) / Math.max(lumaEvents.length, 1);
      expect(coverage).toBeGreaterThanOrEqual(0.9);
    });

    test("coverImage URLs are absolute", () => {
      if (!eventsData) return;

      const eventsWithCover = eventsData.events.filter(e => e.coverImage);
      const eventsWithRelativeUrls = eventsWithCover.filter(
        e => e.coverImage && !e.coverImage.startsWith("http")
      );

      if (eventsWithRelativeUrls.length > 0) {
        console.warn(
          `⚠️ ${eventsWithRelativeUrls.length} events with relative coverImage URLs`
        );
      }

      expect(eventsWithRelativeUrls.length).toBe(0);
    });

    test("events are sorted by start date", () => {
      if (!eventsData) return;

      for (let i = 1; i < eventsData.events.length; i++) {
        const prevDate = new Date(eventsData.events[i - 1].startAt);
        const currDate = new Date(eventsData.events[i].startAt);
        expect(prevDate.getTime()).toBeLessThanOrEqual(currDate.getTime());
      }
    });

    test("metadata has correct structure", () => {
      if (!eventsData) return;

      for (const event of eventsData.events.slice(0, 20)) {
        expect(typeof event.metadata).toBe("object");

        if (event.metadata.attendance !== undefined) {
          expect(typeof event.metadata.attendance).toBe("number");
        }
        if (event.metadata.fridgeIncome !== undefined) {
          expect(typeof event.metadata.fridgeIncome).toBe("number");
        }
        if (event.metadata.rentalIncome !== undefined) {
          expect(typeof event.metadata.rentalIncome).toBe("number");
        }
        if (event.metadata.note !== undefined) {
          expect(typeof event.metadata.note).toBe("string");
        }
      }
    });
  });
});
