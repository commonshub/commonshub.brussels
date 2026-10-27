import { signSettingsLink, verifySettingsLink } from "@/lib/notification-links"

describe("notification settings links", () => {
  it("are made only with the key, and expire", () => {
    const t = signSettingsLink("689614876515237925", Date.now(), "secret")
    expect(verifySettingsLink(t, Date.now(), ["secret"])?.d).toBe("689614876515237925")
    expect(verifySettingsLink(t, Date.now(), ["other"])).toBeNull()
    expect(verifySettingsLink(t.replace(/^./, "x"), Date.now(), ["secret"])).toBeNull()
    expect(verifySettingsLink(t, Date.now() + 400 * 86_400_000, ["secret"])).toBeNull()
    expect(verifySettingsLink("", Date.now(), ["secret"])).toBeNull()
  })
})
