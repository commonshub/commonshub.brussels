import { describe, expect, test } from "@jest/globals";
import roomsData from "@/settings/rooms.json";
import {
  hostedEvents,
  mergeHostedEvents,
  type HomepageEvent,
  type HostedEvent,
} from "@/lib/hosted-events";

const ocd: HostedEvent = {
  slug: "ocd-2026",
  name: "Open Commons Day 2026",
  description: "A day at the hub",
  startAt: "2026-10-04T09:30:00+02:00",
  endAt: "2026-10-04T18:00:00+02:00",
  timezone: "Europe/Brussels",
  location: "Commons Hub Brussels",
  featured: true,
  links: { luma: "https://luma.com/l9275g9x" },
  lumaEventId: "evt-AoOBAKIQvpJKXdV",
  sessions: [],
};

const osv: HostedEvent = {
  ...ocd,
  slug: "osv-2027",
  name: "Open Source Village 2027",
  tagline: "Alongside FOSDEM",
  startAt: "2027-01-25T09:00:00+01:00",
  endAt: "2027-02-05T18:00:00+01:00",
  coverImage: "/images/events/osv-2027.png",
  links: { website: "https://opensourcevillage.org/" },
  lumaEventId: undefined,
};

function lumaEvent(overrides: Partial<HomepageEvent>): HomepageEvent {
  return {
    id: "evt-other",
    name: "Some event",
    description: "",
    start_at: "2026-10-01T18:00:00.000Z",
    end_at: "2026-10-01T20:00:00.000Z",
    cover_url: "",
    url: "https://luma.com/other",
    isExternal: false,
    tags: [],
    ...overrides,
  };
}

describe("mergeHostedEvents", () => {
  const now = new Date("2026-09-19T12:00:00Z");

  test("points the Luma event at our own page", () => {
    const merged = mergeHostedEvents(
      [lumaEvent({ name: "Commons Hub OPEN DAY", url: "https://lu.ma/l9275g9x", start_at: "2026-10-04T07:30:00.000Z" })],
      now,
      [ocd]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      name: "Open Commons Day 2026",
      url: "/events/ocd-2026",
      isExternal: false,
      isFeatured: true,
    });
  });

  test("matches on the Luma event id too", () => {
    const merged = mergeHostedEvents(
      [lumaEvent({ id: "evt-AoOBAKIQvpJKXdV", url: "https://luma.com/renamed" })],
      now,
      [ocd]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].url).toBe("/events/ocd-2026");
  });

  test("adds a hosted event that is not on Luma, in date order", () => {
    const merged = mergeHostedEvents([lumaEvent({})], now, [osv]);
    expect(merged.map((e) => e.url)).toEqual([
      "https://luma.com/other",
      "/events/osv-2027",
    ]);
    expect(merged[1]).toMatchObject({
      description: "Alongside FOSDEM",
      cover_url: "/images/events/osv-2027.png",
      isFeatured: true,
    });
  });

  test("keeps a multi-day event listed while it runs, drops it after", () => {
    expect(mergeHostedEvents([], new Date("2027-02-01T12:00:00Z"), [osv])).toHaveLength(1);
    expect(mergeHostedEvents([], new Date("2027-02-06T12:00:00Z"), [osv])).toHaveLength(0);
  });
});

describe("hosted event data", () => {
  const roomSlugs = roomsData.rooms.map((r) => r.slug);

  test.each(hostedEvents.map((e) => [e.slug, e]))("%s is well-formed", (_, event) => {
    const e = event as HostedEvent;
    expect(e.slug).toMatch(/^[a-z0-9-]+$/);
    expect(new Date(e.startAt).getTime()).toBeLessThan(new Date(e.endAt).getTime());
    for (const session of e.sessions) {
      expect(session.start).toMatch(/^\d{2}:\d{2}$/);
      if (session.room) expect(roomSlugs).toContain(session.room);
    }
  });

  test("slugs are unique", () => {
    const slugs = hostedEvents.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
