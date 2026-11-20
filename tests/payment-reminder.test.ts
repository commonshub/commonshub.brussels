import { buildPaymentReminderEmail, type Application } from "@/lib/membership-application"

const a: Application = {
  id: "abc123",
  submittedAt: "2026-11-01T10:00:00Z",
  type: "individual",
  name: "Ada Lovelace",
  email: "ada@example.org",
  needs: [],
  status: "approved",
  approvedAt: "2026-11-05T10:00:00Z",
  monthly: 15,
}

describe("payment reminder", () => {
  it("says we couldn't find the payment, links to pay, and how to tell us it's a mistake", () => {
    const e = buildPaymentReminderEmail(a, [{ name: "Leen" }, { name: "Miriam" }, { name: "Xavier" }])
    expect(e.subject).toBe("Your Commons Hub membership: we couldn't find your payment")
    expect(e.text).toContain("Your membership application was accepted on 5 November (Leen, Miriam and Xavier vouched for you), but we couldn't find your membership payment.")
    expect(e.text).toContain("Pay €15 a month")
    expect(e.text).toContain("If this is a mistake")
    expect(e.html).toContain("client_reference_id=application_abc123")
  })

  it("without vouchers on record", () => {
    expect(buildPaymentReminderEmail(a, []).text).toContain("accepted on 5 November, but we couldn't find")
  })
})
