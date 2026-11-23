import { buildVouchReminderEmail, nextPotluck, vouchedLine, type Application } from "@/lib/membership-application"

const a: Application = { id: "abc123", submittedAt: "2026-11-09T10:00:00Z", type: "individual", name: "Ada Lovelace", email: "ada@example.org", needs: [], status: "pending" }
const now = new Date("2026-11-23T10:00:00Z") // a Monday
const events = [
  { name: "Open Commons Day", startAt: "2026-11-25T17:00:00Z", url: "/events/open-commons-day" },
  { name: "Repair café", startAt: "2026-11-28T13:00:00Z", url: "https://luma.com/abc" },
]

describe("vouch reminder", () => {
  it("names who vouched, cced or not, with the verb and the vouches still needed agreeing", () => {
    expect(vouchedLine([{ name: "Leen", cc: true }])).toBe("Leen (cced) has already vouched for you.")
    expect(vouchedLine([{ name: "Leen", cc: true }, { name: "Miriam", cc: true }])).toBe("Leen and Miriam (both cced) have already vouched for you.")
    expect(vouchedLine([{ name: "Leen", cc: true }, { name: "Miriam" }])).toBe("Leen (cced) and Miriam have already vouched for you.")
    expect(vouchedLine([{ name: "Leen" }])).toBe("Leen has already vouched for you.")

    const one = buildVouchReminderEmail(a, [{ name: "Leen", cc: true }], events, now).text
    expect(one).toContain("you have one vouch so far, two more are needed.")
    expect(one).toContain("Leen (cced) has already vouched for you. Ask them to help you secure the last two vouches still needed.")

    const two = buildVouchReminderEmail(a, [{ name: "Leen", cc: true }, { name: "Miriam", cc: true }], events, now).text
    expect(two).toContain("you have two vouches so far, one more is needed.")
    expect(two).toContain("Ask them to help you secure the last vouch still needed.")
  })

  it("with no vouch yet: nobody named, come and meet us", () => {
    const e = buildVouchReminderEmail(a, [], events, now)
    expect(e.subject).toBe("Come and meet us at the Commons Hub, Ada")
    expect(e.text).toContain("on 9 November. To be accepted, three members need to vouch for you, and nobody has yet.")
    expect(e.text).not.toContain("vouched for you")
  })

  it("invites to the next Friday potluck, the events of the next two weeks (linked), all events, or to write to hello@", () => {
    const e = buildVouchReminderEmail(a, [], events, now)
    expect(e.text).toContain("come at 12:30 and bring something to share. The next one is on Friday 27 November")
    expect(e.text).toContain("Or come to one of our upcoming events in the next two weeks:")
    expect(e.text).toContain("- Wed 25 Nov, 18:00: Open Commons Day (https://commonshub.brussels/events/open-commons-day)")
    expect(e.text).toContain("See all upcoming events: https://commonshub.brussels/events")
    expect(e.text).toContain("Write to hello@commonshub.brussels and we'll arrange a time to meet.")
    expect(e.html).toContain('href="mailto:hello@commonshub.brussels"')
    expect(e.text).toContain("We look forward to having you as part of the community.")
    expect(buildVouchReminderEmail(a, [], [events[0]], now).text).toContain("Or come to our upcoming event in the next two weeks:")
  })

  it("next potluck: this Friday before it ends, else the next one", () => {
    const day = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: "Europe/Brussels", day: "numeric", month: "short" })
    expect(day(nextPotluck(new Date("2026-11-27T10:00:00Z")))).toBe("27 Nov")
    expect(day(nextPotluck(new Date("2026-11-27T14:00:00Z")))).toBe("4 Dec")
  })
})
