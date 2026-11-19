import { buildPaymentReminderEmail, type Application } from "@/lib/membership-application"

const a: Application = {
  id: "abc123",
  submittedAt: "2026-11-01T10:00:00Z",
  type: "individual",
  name: "Ada Lovelace",
  email: "ada@example.org",
  needs: [],
  contribute: "Workshops on   computing\nfor kids.",
  status: "approved",
  approvedAt: "2026-11-05T10:00:00Z",
  monthly: 15,
}

describe("payment reminder", () => {
  it("names who vouched, quotes what they'd bring, and links to pay", () => {
    const e = buildPaymentReminderEmail(a, [{ name: "Leen" }, { name: "Miriam" }, { name: "Xavier" }])
    expect(e.subject).toBe("Leen, Miriam and Xavier are waiting for you at the Commons Hub, Ada")
    expect(e.text).toContain("Leen, Miriam and Xavier vouched for you")
    expect(e.text).toContain('"Workshops on computing for kids."')
    expect(e.text).toContain("Pay €15 a month")
    expect(e.html).toContain("client_reference_id=application_abc123")
  })

  it("says when they were accepted", () => {
    expect(buildPaymentReminderEmail(a, [{ name: "Leen" }], new Date("2026-11-12T12:00:00Z")).text).toContain("A week ago, Leen vouched")
    expect(buildPaymentReminderEmail(a, [{ name: "Leen" }], new Date("2026-11-30T12:00:00Z")).text).toContain("On 5 November, Leen vouched")
  })

  it("reads well with one voucher or none", () => {
    expect(buildPaymentReminderEmail(a, [{ name: "Leen" }]).subject).toBe("Leen is waiting for you at the Commons Hub, Ada")
    const none = buildPaymentReminderEmail({ ...a, contribute: undefined }, [])
    expect(none.subject).toBe("We're waiting for you at the Commons Hub, Ada")
    expect(none.text).not.toContain("you told us")
  })
})
