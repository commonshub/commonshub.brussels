import { pickLang, ruleText, TEXT } from "@/lib/vat-i18n"
import { EXPENSE_RULES, INCOME_RULES } from "@/lib/vat-position"

describe("VAT page language", () => {
  it("?lang= wins, then the cookie, then the browser", () => {
    expect(pickLang("fr", "en", "en-GB")).toBe("fr")
    expect(pickLang(null, "fr", "en-GB")).toBe("fr")
    expect(pickLang(null, null, "fr-BE,fr;q=0.9,en;q=0.8")).toBe("fr")
    expect(pickLang(null, null, "nl-BE,en;q=0.8")).toBe("en")
    expect(pickLang(null, null, null)).toBe("en")
    expect(pickLang("de", null, "de")).toBe("en")
  })
  it("every category has a French label and reason", () => {
    for (const k of Object.keys(INCOME_RULES)) expect(ruleText("fr", "income", k, { label: "x", why: "x" }).why).not.toBe("Une catégorie sans règle de TVA pour l'instant.")
    for (const k of Object.keys(EXPENSE_RULES)) expect(ruleText("fr", "expense", k, { label: "x", why: "x" }).why).not.toBe("Une catégorie sans règle de TVA pour l'instant.")
  })
  it("the summary says who owes whom", () => {
    const p = { x1: "€1", x2: "€0", gap: "€1", z: "€9", z2: "€5", z3: "€3", refunded: "€5" }
    expect(TEXT.en.tldr({ ...p, stateOwes: true })[2]).toContain("the State would still owe us €3")
    expect(TEXT.fr.tldr({ ...p, stateOwes: false })[2]).toContain("nous devrions encore €3 à l'État")
  })
})
