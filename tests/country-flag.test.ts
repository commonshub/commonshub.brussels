import { countryFlag } from "@/lib/country-flag"

describe("country flags in notes", () => {
  it("finds the country a note names", () => {
    expect(countryFlag("Plural Everything Inc., invoice RV202411 (United States: outside the EU, grid 47)")).toBe("🇺🇸")
    expect(countryFlag("Kolektivo Labs B.V. (Netherlands, VAT NL863356151B01: EU B2B)")).toBe("🇳🇱")
    expect(countryFlag("Golem Stiftung (Switzerland, per the payer's Swiss bank account)")).toBe("🇨🇭")
    expect(countryFlag("Gnosis Ltd. (Gibraltar: outside the EU)")).toBe("🇬🇮")
    expect(countryFlag("Belgian public subsidy: outside the scope of VAT")).toBe("🇧🇪")
    expect(countryFlag("Brussels Pay, invoice 2024/017")).toBe("")
    expect(countryFlag(undefined)).toBe("")
  })
})
