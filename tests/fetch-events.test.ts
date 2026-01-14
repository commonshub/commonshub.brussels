/**
 * Tests for fetch-events script
 */

import * as fs from "fs";
import * as path from "path";
import ical from "node-ical";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "tests/data");
const TEST_YEAR = "2025";
const TEST_MONTH = "11";

describe("Fetch Events Script", () => {
  const icalPath = path.join(
    DATA_DIR,
    TEST_YEAR,
    TEST_MONTH,
    "ical",
    "calendar.ics"
  );

  test("calendar.ics file exists for test month", () => {
    expect(fs.existsSync(icalPath)).toBe(true);
  });

  test("calendar.ics has valid iCal format", () => {
    const content = fs.readFileSync(icalPath, "utf-8");

    // Check iCal structure
    expect(content).toContain("BEGIN:VCALENDAR");
    expect(content).toContain("END:VCALENDAR");
    expect(content).toContain("VERSION:2.0");
    expect(content).toContain("PRODID:");
  });

  test("all events in calendar.ics are from the correct month", async () => {
    const content = fs.readFileSync(icalPath, "utf-8");
    const events = await ical.async.parseICS(content);

    const eventArray = Object.values(events).filter(
      (event: any) => event.type === "VEVENT"
    );

    expect(eventArray.length).toBeGreaterThan(0);

    for (const event of eventArray) {
      const startDate = event.start as Date;
      expect(startDate).toBeDefined();

      const eventYear = startDate.getFullYear().toString();
      const eventMonth = String(startDate.getMonth() + 1).padStart(2, "0");

      expect(eventYear).toBe(TEST_YEAR);
      expect(eventMonth).toBe(TEST_MONTH);
    }
  });

  test("events have required iCal fields", async () => {
    const content = fs.readFileSync(icalPath, "utf-8");
    const events = await ical.async.parseICS(content);

    const eventArray = Object.values(events).filter(
      (event: any) => event.type === "VEVENT"
    );

    for (const event of eventArray) {
      expect(event.uid).toBeDefined();
      expect(event.summary || event.name).toBeDefined();
      expect(event.start).toBeDefined();
    }
  });

  test("Luma cache exists and has valid structure", () => {
    const lumaPath = path.join(
      DATA_DIR,
      TEST_YEAR,
      TEST_MONTH,
      "luma",
      "cal-kWlIiw3HsJFhs25.json"
    );

    // This may not exist if LUMA_API_KEY is not set
    if (fs.existsSync(lumaPath)) {
      const content = fs.readFileSync(lumaPath, "utf-8");
      const data = JSON.parse(content);

      expect(Array.isArray(data)).toBe(true);

      if (data.length > 0) {
        const firstEvent = data[0];
        expect(firstEvent).toHaveProperty("api_id");
        expect(firstEvent).toHaveProperty("name");
        expect(firstEvent).toHaveProperty("start_at");
      }
    }
  });
});
