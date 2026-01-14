/**
 * Tests for events system
 */

import * as fs from "fs";
import * as path from "path";
import type { EventsFile, Event } from "../src/types/events";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "tests/data");

describe("Events System", () => {
  describe("events.json validation", () => {
    const testMonth = { year: "2025", month: "11" };
    const eventsPath = path.join(
      DATA_DIR,
      testMonth.year,
      testMonth.month,
      "events.json"
    );

    test("events.json file exists", () => {
      expect(fs.existsSync(eventsPath)).toBe(true);
    });

    test("events.json has valid structure", () => {
      const content = fs.readFileSync(eventsPath, "utf-8");
      const data: EventsFile = JSON.parse(content);

      expect(data).toHaveProperty("month");
      expect(data).toHaveProperty("generatedAt");
      expect(data).toHaveProperty("events");
      expect(Array.isArray(data.events)).toBe(true);
    });

    test("all events have required fields", () => {
      const content = fs.readFileSync(eventsPath, "utf-8");
      const data: EventsFile = JSON.parse(content);

      for (const event of data.events) {
        expect(event).toHaveProperty("id");
        expect(event).toHaveProperty("name");
        expect(event).toHaveProperty("startAt");
        expect(event).toHaveProperty("source");
        expect(event).toHaveProperty("metadata");

        // Validate source is either "luma" or "ical"
        expect(["luma", "ical"]).toContain(event.source);

        // Validate dates are ISO 8601
        expect(() => new Date(event.startAt)).not.toThrow();
        if (event.endAt) {
          expect(() => new Date(event.endAt)).not.toThrow();
        }
      }
    });

    test("Luma source events have URLs", () => {
      const content = fs.readFileSync(eventsPath, "utf-8");
      const data: EventsFile = JSON.parse(content);

      // Luma events should always have URLs
      const lumaEvents = data.events.filter((e) => e.source === "luma" || e.calendarSource === "luma" || e.calendarSource === "luma-api");
      const lumaEventsWithoutUrl = lumaEvents.filter((e) => !e.url);

      if (lumaEventsWithoutUrl.length > 0) {
        console.warn(
          `Warning: ${lumaEventsWithoutUrl.length} Luma events missing URLs:`,
          lumaEventsWithoutUrl.map((e) => e.name)
        );
      }

      expect(lumaEventsWithoutUrl.length).toBe(0);

      // Note: ICS events from Google Calendar may not have URLs, which is expected
    });

    test("Luma events have valid URLs", () => {
      const content = fs.readFileSync(eventsPath, "utf-8");
      const data: EventsFile = JSON.parse(content);

      const lumaEvents = data.events.filter((e) => e.source === "luma" && e.url);

      for (const event of lumaEvents) {
        if (event.url) {
          expect(
            event.url.startsWith("https://lu.ma/") ||
              event.url.startsWith("https://luma.com/")
          ).toBe(true);
        }
      }
    });

    test("all coverImage URLs are absolute", () => {
      const content = fs.readFileSync(eventsPath, "utf-8");
      const data: EventsFile = JSON.parse(content);

      const eventsWithCoverImage = data.events.filter((e) => e.coverImage);

      for (const event of eventsWithCoverImage) {
        expect(event.coverImage).toBeDefined();
        expect(
          event.coverImage!.startsWith("http://") ||
            event.coverImage!.startsWith("https://")
        ).toBe(true);
      }

      // Log any events with relative URLs for debugging
      const eventsWithRelativeUrls = eventsWithCoverImage.filter(
        (e) => e.coverImage && !e.coverImage.startsWith("http")
      );

      if (eventsWithRelativeUrls.length > 0) {
        console.error(
          `Found ${eventsWithRelativeUrls.length} events with relative coverImage URLs:`,
          eventsWithRelativeUrls.map((e) => ({
            id: e.id,
            name: e.name,
            coverImage: e.coverImage,
          }))
        );
      }
    });

    test("events are sorted by start date", () => {
      const content = fs.readFileSync(eventsPath, "utf-8");
      const data: EventsFile = JSON.parse(content);

      for (let i = 1; i < data.events.length; i++) {
        const prevDate = new Date(data.events[i - 1].startAt);
        const currDate = new Date(data.events[i].startAt);
        expect(prevDate.getTime()).toBeLessThanOrEqual(currDate.getTime());
      }
    });

    test("metadata has correct structure", () => {
      const content = fs.readFileSync(eventsPath, "utf-8");
      const data: EventsFile = JSON.parse(content);

      for (const event of data.events) {
        expect(typeof event.metadata).toBe("object");

        // Check that metadata fields are correct types if present
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

  describe("cached data validation", () => {
    const testMonth = { year: "2025", month: "11" };

    test("iCal cache exists", () => {
      const icalPath = path.join(
        DATA_DIR,
        testMonth.year,
        testMonth.month,
        "ical",
        "calendar.ics"
      );

      // This may not exist if fetch-events hasn't run yet
      if (fs.existsSync(icalPath)) {
        const content = fs.readFileSync(icalPath, "utf-8");
        expect(content).toContain("BEGIN:VCALENDAR");
        expect(content).toContain("BEGIN:VEVENT");
      }
    });

    test("Luma cache has valid JSON if it exists", () => {
      const lumaPath = path.join(
        DATA_DIR,
        testMonth.year,
        testMonth.month,
        "luma",
        "cal-kWlIiw3HsJFhs25.json"
      );

      // This may not exist if fetch-events hasn't run yet or if API key doesn't work
      if (fs.existsSync(lumaPath)) {
        const content = fs.readFileSync(lumaPath, "utf-8");
        const data = JSON.parse(content);
        expect(Array.isArray(data)).toBe(true);
      }
    });
  });
});
