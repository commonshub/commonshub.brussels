import { buildRecap, doorDays, tokenReason } from "@/lib/monthly-recap"
import { buildRecapEmail } from "@/lib/monthly-recap-email"

const me = { id: "42", username: "xavier", name: "Xavier" }
const ADDR = "0xAbC0000000000000000000000000000000000001"
const tx = (type: string, amount: number, description = "", t?: string) => ({
  accountId: `ethereum:42220:address:${ADDR.toLowerCase()}`,
  currency: "CHT",
  type,
  amount,
  timestamp: 1791000000 + amount,
  metadata: { description, ...(t ? { t } : {}) },
})

describe("tokenReason", () => {
  it("reads like what it was for", () => {
    expect(tokenReason({ type: "MINT", metadata: { description: "Issued 3 CHT to leen8610 for a 3h shift on 02/10/2026 at 08:30" } })).toBe("For a 3h shift on 02/10/2026 at 08:30")
    expect(tokenReason({ type: "MINT", metadata: { description: "Heartbeat 107 attendance on 2026-10-12: Miriam, Xavier, Ben" } })).toBe("Heartbeat 107 attendance on 2026-10-12")
    expect(tokenReason({ type: "BURN", metadata: { description: "Guest pass, half day for Xavier: for a guest, today, 16:51–21:51" } })).toBe("Guest pass, half day")
    expect(tokenReason({ type: "BURN", metadata: { note: "Booking Ostrom Room room for 3h" } })).toBe("Booking Ostrom Room for 3h")
    expect(tokenReason({ type: "DEBIT", metadata: {} })).toBe("Sent to another member")
    expect(tokenReason({ type: "MINT", metadata: { t: "shift" } })).toBe("Caretaking shift")
  })
})

describe("doorDays", () => {
  it("prefers their Discord entry, else their name", () => {
    expect(doorDays({ openers: [{ name: "xavier", days: 3 }, { id: "42", days: 18 }] }, me)).toBe(18)
    expect(doorDays({ openers: [{ name: "Xavier", days: 3 }] }, me)).toBe(3)
    expect(doorDays(null, me)).toBe(0)
  })
})

describe("buildRecap", () => {
  const files = {
    door: { openers: [{ id: "42", days: 5 }] },
    transactions: {
      transactions: [
        tx("MINT", 3, "Issued 3 CHT to xavier for a 3h shift"),
        tx("MINT", 1.5, "Heartbeat 1 attendance on 2026-10-12: Ana"),
        tx("BURN", -2, "Booking Mush Room room for 2h"),
        tx("DEBIT", -1),
        { ...tx("MINT", 9, "someone else's"), accountId: "ethereum:42220:address:0xdead" },
        { ...tx("MINT", 4, "euros"), currency: "EURe" },
      ],
    },
    praise: {
      messages: [
        { id: "1", timestamp: "2026-10-03T10:00:00Z", author: { id: "7", displayName: "Ana" }, content: "@Xavier for fixing the door!", mentions: [{ id: "42", displayName: "Xavier" }] },
        { id: "2", timestamp: "2026-10-04T10:00:00Z", author: { id: "7", displayName: "Ana" }, content: "@Tom for the soup", mentions: [{ id: "9", displayName: "Tom" }] },
        { id: "3", timestamp: "2026-10-05T10:00:00Z", author: { id: "42", displayName: "Xavier" }, content: "@Xavier me", mentions: [{ id: "42", displayName: "Xavier" }] },
      ],
    },
    contributions: {
      messages: [
        { id: "a", timestamp: "2026-10-02T10:00:00Z", author: { id: "7", displayName: "Ana" }, content: "Mopped", images: ["2026/10/public/images/1.jpg"] },
        { id: "b", timestamp: "2026-10-01T10:00:00Z", author: { id: "42", displayName: "Xavier" }, content: "Plants", images: ["2026/10/public/images/2.jpg", "https://evil.example/x.jpg"] },
      ],
    },
    events: { events: [{ name: "Past", startAt: "2026-10-01T18:00:00Z", url: "https://lu.ma/past" }, { name: "Potluck", startAt: "2026-11-05T18:00:00Z", url: "https://lu.ma/potluck" }] },
  }
  const r = buildRecap(me, "2026", "10", files, ADDR, new Date("2026-10-27T12:00:00Z"))

  it("counts only their own token movements, and the totals add up", () => {
    expect(r.received.map((l) => l.amount)).toEqual([1.5, 3])
    expect(r.spent.map((l) => l.what)).toEqual(["Booking Mush Room for 2h", "Sent to another member"])
    expect(r.receivedTotal).toBe(4.5)
    expect(r.spentTotal).toBe(3)
  })
  it("has the thank-yous others gave them, the month's photos (theirs first) and upcoming events", () => {
    expect(r.days).toBe(5)
    expect(r.praise).toEqual([{ at: Date.parse("2026-10-03T10:00:00Z"), from: { name: "Ana" }, text: "for fixing the door!" }])
    expect(r.photos.map((p) => p.src)).toEqual(["/data/2026/10/public/images/2.jpg", "/data/2026/10/public/images/1.jpg"])
    expect(r.events.map((e) => e.name)).toEqual(["Potluck"])
  })
  it("renders an email with the CTA and the online link", () => {
    const { subject, html, text } = buildRecapEmail(r, { origin: "https://commonshub.brussels" })
    expect(subject).toBe("Your October at the Commons Hub")
    expect(html).toContain("https://commonshub.brussels/shifts")
    expect(html).toContain("https://commonshub.brussels/xavier/2026/10")
    expect(html).toContain("for fixing the door!")
    expect(text).toContain("+4.5 tokens received")
    expect(html).not.toContain("CHT")
  })
})
