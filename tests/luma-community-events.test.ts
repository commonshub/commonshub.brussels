/**
 * Tests that community events from the Luma API (not in the ICS feed)
 * are included in the generated events.json.
 *
 * The Luma ICS feed only contains events created by the calendar owner.
 * Community events (hosted by others but listed on the calendar) only
 * appear in the Luma API response.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const DATA_DIR = path.join(process.cwd(), "tests/data");
const TEST_YEAR = "2026";
const TEST_MONTH = "03";

describe("Luma community events (API-only, not in ICS)", () => {
  const eventsJsonPath = path.join(DATA_DIR, TEST_YEAR, TEST_MONTH, "events.json");

  beforeAll(() => {
    // Run generate-events for the test month using the test data directory
    execSync(
      `npx tsx scripts/generate-events.ts --month=${TEST_YEAR}-${TEST_MONTH}`,
      {
        env: { ...process.env, DATA_DIR },
        stdio: "pipe",
      }
    );
  });

  test("events.json is generated", () => {
    expect(fs.existsSync(eventsJsonPath)).toBe(true);
  });

  test("includes events from ICS feed", () => {
    const data = JSON.parse(fs.readFileSync(eventsJsonPath, "utf-8"));
    const names = data.events.map((e: any) => e.name);

    expect(names).toContain("Langchain Meetup");
    expect(names).toContain("Open Community Potluck Lunch");
  });

  test("includes community events only present in Luma API", () => {
    const data = JSON.parse(fs.readFileSync(eventsJsonPath, "utf-8"));
    const names = data.events.map((e: any) => e.name);

    // These events are NOT in the ICS feed, only in the Luma API cache
    expect(names).toContain("Founders Running Club :: Brussels");
    expect(names).toContain("Workshop: New Narrative Collage");
  });

  test("community events have correct source metadata", () => {
    const data = JSON.parse(fs.readFileSync(eventsJsonPath, "utf-8"));
    const communityEvent = data.events.find(
      (e: any) => e.name === "Founders Running Club :: Brussels"
    );

    expect(communityEvent).toBeDefined();
    expect(communityEvent.source).toBe("luma");
    expect(communityEvent.calendarSource).toBe("luma-api");
    expect(communityEvent.url).toBe("https://luma.com/founders-run-mar15");
    expect(communityEvent.lumaData).toBeDefined();
    expect(communityEvent.lumaData.hosted_by).toBe("Founders Running Club");
  });

  test("community events have tags from Luma API", () => {
    const data = JSON.parse(fs.readFileSync(eventsJsonPath, "utf-8"));
    const workshop = data.events.find(
      (e: any) => e.name === "Workshop: New Narrative Collage"
    );

    expect(workshop).toBeDefined();
    expect(workshop.tags).toBeDefined();
    expect(workshop.tags.length).toBeGreaterThan(0);
    expect(workshop.tags[0].name).toBe("workshop");
  });

  test("no duplicate events when ICS and API have the same event", () => {
    const data = JSON.parse(fs.readFileSync(eventsJsonPath, "utf-8"));

    // Langchain Meetup exists in both ICS and API - should appear only once
    const langchainEvents = data.events.filter(
      (e: any) => e.name === "Langchain Meetup"
    );
    expect(langchainEvents.length).toBe(1);
  });

  test("total event count matches ICS + API-only events", () => {
    const data = JSON.parse(fs.readFileSync(eventsJsonPath, "utf-8"));

    // 2 from ICS + 2 API-only = 4 total
    expect(data.events.length).toBe(4);
  });

  test("events are sorted by start date", () => {
    const data = JSON.parse(fs.readFileSync(eventsJsonPath, "utf-8"));
    const dates = data.events.map((e: any) => new Date(e.startAt).getTime());

    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
    }
  });
});
