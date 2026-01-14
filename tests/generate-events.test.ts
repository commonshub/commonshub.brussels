/**
 * Tests for generate-events script
 */

import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "tests/data");
const TEST_YEAR = "2025";
const TEST_MONTH = "11";

interface EventMetadata {
  attendance?: number;
  fridgeIncome?: number;
  rentalIncome?: number;
  note?: string;
}

interface EventGuest {
  name: string;
  avatar_url?: string;
  approval_status: string;
}

interface Event {
  id: string;
  name: string;
  description?: string;
  startAt: string;
  endAt?: string;
  timezone?: string;
  location?: string;
  url?: string;
  coverImage?: string;
  coverImageLocal?: string;
  source: "luma" | "ical";
  lumaData?: any;
  guests?: EventGuest[];
  metadata: EventMetadata;
}

interface EventsFile {
  month: string;
  generatedAt: string;
  events: Event[];
}

describe("Generate Events Script", () => {
  const eventsPath = path.join(
    DATA_DIR,
    TEST_YEAR,
    TEST_MONTH,
    "events.json"
  );

  test("events.json file exists", () => {
    expect(fs.existsSync(eventsPath)).toBe(true);
  });

  test("events.json has valid structure", () => {
    const content = fs.readFileSync(eventsPath, "utf-8");
    const data: EventsFile = JSON.parse(content);

    expect(data).toHaveProperty("month");
    expect(data.month).toBe(`${TEST_YEAR}-${TEST_MONTH}`);
    expect(data).toHaveProperty("generatedAt");
    expect(data).toHaveProperty("events");
    expect(Array.isArray(data.events)).toBe(true);
  });

  test("all events have required fields", () => {
    const content = fs.readFileSync(eventsPath, "utf-8");
    const data: EventsFile = JSON.parse(content);

    expect(data.events.length).toBeGreaterThan(0);

    for (const event of data.events) {
      expect(event).toHaveProperty("id");
      expect(event.id).toBeTruthy();

      expect(event).toHaveProperty("name");
      expect(event.name).toBeTruthy();

      expect(event).toHaveProperty("startAt");
      expect(event.startAt).toBeTruthy();

      expect(event).toHaveProperty("source");
      expect(["luma", "ical"]).toContain(event.source);

      expect(event).toHaveProperty("metadata");
      expect(typeof event.metadata).toBe("object");
    }
  });

  test("all events have URLs", () => {
    const content = fs.readFileSync(eventsPath, "utf-8");
    const data: EventsFile = JSON.parse(content);

    const eventsWithoutUrl = data.events.filter((e) => !e.url);

    if (eventsWithoutUrl.length > 0) {
      console.warn(
        `Warning: ${eventsWithoutUrl.length} events missing URLs:`,
        eventsWithoutUrl.map((e) => ({ id: e.id, name: e.name }))
      );
    }

    expect(eventsWithoutUrl.length).toBe(0);
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

    expect(eventsWithRelativeUrls.length).toBe(0);
  });

  test("events with coverImage have coverImageLocal", () => {
    const content = fs.readFileSync(eventsPath, "utf-8");
    const data: EventsFile = JSON.parse(content);

    const eventsWithCoverImage = data.events.filter((e) => e.coverImage);

    for (const event of eventsWithCoverImage) {
      expect(event.coverImageLocal).toBeDefined();
      expect(event.coverImageLocal).toBeTruthy();
    }
  });

  test("coverImageLocal paths use correct source folders", () => {
    const content = fs.readFileSync(eventsPath, "utf-8");
    const data: EventsFile = JSON.parse(content);

    const eventsWithLocalImage = data.events.filter((e) => e.coverImageLocal);

    for (const event of eventsWithLocalImage) {
      if (event.source === "luma") {
        expect(event.coverImageLocal).toContain("/luma/images/");
      } else if (event.source === "ical") {
        expect(event.coverImageLocal).toContain("/ical/images/");
      }
    }
  });

  test("event IDs do not contain @events.lu.ma suffix", () => {
    const content = fs.readFileSync(eventsPath, "utf-8");
    const data: EventsFile = JSON.parse(content);

    const eventsWithSuffix = data.events.filter((e) =>
      e.id.includes("@events.lu.ma")
    );

    if (eventsWithSuffix.length > 0) {
      console.error(
        `Found ${eventsWithSuffix.length} events with @events.lu.ma suffix:`,
        eventsWithSuffix.map((e) => e.id)
      );
    }

    expect(eventsWithSuffix.length).toBe(0);
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

  test("events are sorted by start date", () => {
    const content = fs.readFileSync(eventsPath, "utf-8");
    const data: EventsFile = JSON.parse(content);

    for (let i = 1; i < data.events.length; i++) {
      const prevDate = new Date(data.events[i - 1].startAt);
      const currDate = new Date(data.events[i].startAt);
      expect(prevDate.getTime()).toBeLessThanOrEqual(currDate.getTime());
    }
  });

  test("downloaded images exist for events with coverImageLocal", () => {
    const content = fs.readFileSync(eventsPath, "utf-8");
    const data: EventsFile = JSON.parse(content);

    const eventsWithLocalImage = data.events.filter(
      (e) => e.coverImageLocal && !e.coverImageLocal.startsWith("http")
    );

    for (const event of eventsWithLocalImage) {
      const imagePath = path.join(DATA_DIR, event.coverImageLocal!);

      if (!fs.existsSync(imagePath)) {
        console.warn(
          `Missing image for event ${event.id} (${event.name}): ${imagePath}`
        );
      }

      expect(fs.existsSync(imagePath)).toBe(true);
    }
  });

  test("guest lists do not contain email addresses", () => {
    const content = fs.readFileSync(eventsPath, "utf-8");
    const data: EventsFile = JSON.parse(content);

    const eventsWithGuests = data.events.filter(
      (e) => e.guests && e.guests.length > 0
    );

    for (const event of eventsWithGuests) {
      for (const guest of event.guests!) {
        expect(guest).not.toHaveProperty("email");
      }
    }
  });

  test("metadata has correct structure", () => {
    const content = fs.readFileSync(eventsPath, "utf-8");
    const data: EventsFile = JSON.parse(content);

    for (const event of data.events) {
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
