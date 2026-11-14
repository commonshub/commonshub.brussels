import { txPagePath, txSlug } from "@/lib/tx-slug"
import { isPartyId } from "@/lib/nip73"

describe("transaction page address", () => {
  it("uses the hash, or the provider's own id", () => {
    expect(txSlug("ethereum:100:tx:0xAbC")).toBe("0xAbC")
    expect(txSlug("iban:be46734072238636:tx:05c29e5b7a9d641f")).toBe("05c29e5b7a9d641f")
    expect(txSlug("wise:88938999:tx:123")).toBe("123")
    expect(txSlug("stripe:txn_3QTTSp")).toBe("txn_3QTTSp")
  })
  it("files it under its month", () => {
    expect(txPagePath("ethereum:137:tx:0xabc", "2024-05-30")).toBe("/2024/05/transactions/0xabc")
  })
})

describe("which counterparty ids can be named", () => {
  it("a real address or customer, not a masked or shared id, nor our own account", () => {
    expect(isPartyId("ethereum:137:address:0xabc")).toBe(true)
    expect(isPartyId("stripe:customer:cus_1")).toBe(true)
    expect(isPartyId("iban:[IBAN]")).toBe(false)
    expect(isPartyId("ethereum:100:token:0x420ca0f9b9b604ce0fd9c18ef134c705e5fa3430")).toBe(false)
    expect(isPartyId("ethereum:100:address:0x1", "ethereum:100:address:0x1")).toBe(false)
    expect(isPartyId(null)).toBe(false)
  })
})
