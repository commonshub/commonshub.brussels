import { describe, expect, test } from "@jest/globals"
import { nip73Kind } from "@/lib/nip73"

// The `k` tag must match what chb writes (cmd/nostr_publish.go uriKind) and what the open-data skill documents.
describe("nip73Kind", () => {
  test.each([
    ["stripe:txn_3TXKEZFAhaWeDyow2vRqC0Sm", "stripe:txn"],
    ["stripe:cus_ABC", "stripe:cus"],
    ["stripe:customer:cus_ABC", "stripe:customer"],
    ["ethereum:100:tx:0x9ca5", "ethereum:tx"],
    ["ethereum:42220:address:0xabc", "ethereum:address"],
    ["iban:be46000000000000:tx:abc123", "iban:tx"],
    ["odoo:commonshub.odoo.com:commonshub:account.move:45973", "odoo:account.move"],
    ["odoo:commonshub.odoo.com:commonshub:hr.expense:12", "odoo:hr.expense"],
    ["chb:expense:rent", "chb:expense"],
  ])("%s → %s", (uri, kind) => {
    expect(nip73Kind(uri)).toBe(kind)
  })
})
