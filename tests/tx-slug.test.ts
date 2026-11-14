import { txPagePath, txSlug } from "@/lib/tx-slug"

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
