import { describe, expect, test } from "@jest/globals"
import { applyHandManagedEvents, eventKey, type ListedEvent } from "@/lib/pinned-events"

const now = new Date("2026-09-20T12:00:00Z")
const imported = (over: Partial<ListedEvent>): ListedEvent => ({
  id: "evt-1",
  name: "Potluck",
  description: "",
  start_at: "2026-09-25T12:00:00+02:00",
  end_at: "",
  cover_url: "",
  url: "https://luma.com/5vz9qcwz",
  isExternal: false,
  ...over,
})

const config = {
  featured: ["https://luma.com/l9275g9x"],
  pinned: [
    { name: "Commons Hub OPEN DAY", url: "https://luma.com/l9275g9x", startAt: "2026-10-04T09:30:00+02:00", coverImage: "https://images.lumacdn.com/x.png" },
    { name: "Long gone", url: "https://luma.com/old", startAt: "2026-01-01T09:30:00+02:00" },
  ],
}

describe("hand-managed events", () => {
  test("a pinned event is listed, featured, and in date order", () => {
    const out = applyHandManagedEvents([imported({})], now, config)
    expect(out.map((e) => e.name)).toEqual(["Potluck", "Commons Hub OPEN DAY"])
    expect(out[1].isFeatured).toBe(true)
    expect(out[1].cover_url).toBe("https://images.lumacdn.com/x.png")
    expect(out[0].isFeatured).toBeUndefined()
  })

  test("a pinned event that is past is not listed", () => {
    const out = applyHandManagedEvents([], now, config)
    expect(out.map((e) => e.name)).toEqual(["Commons Hub OPEN DAY"])
  })

  test("once Luma has the event, the imported record wins and is still featured", () => {
    const fromLuma = imported({ id: "evt-AoOB", name: "Commons Hub OPEN DAY (Luma)", url: "https://lu.ma/l9275g9x", start_at: "2026-10-04T09:30:00+02:00" })
    const out = applyHandManagedEvents([fromLuma], now, config)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe("evt-AoOB")
    expect(out[0].isFeatured).toBe(true)
  })

  test("eventKey treats luma.com, lu.ma, slashes and query strings alike", () => {
    expect(eventKey("https://lu.ma/l9275g9x/")).toBe("luma.com/l9275g9x")
    expect(eventKey("http://www.luma.com/l9275g9x?utm=x")).toBe("luma.com/l9275g9x")
  })
})
