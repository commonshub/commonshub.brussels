import { describe, expect, test } from "@jest/globals"

import { approvePairing, collectPairing, createPairing, findPairing, PAIRING_TTL_MS } from "@/lib/tablet-pairing"

describe("pairing the hub's tablet from a steward's phone", () => {
  test("the tablet gets its trust only once a steward approved, and only once", () => {
    const now = Date.now()
    const p = createPairing(now)!
    expect(p.code).toMatch(/^\d{6}$/)
    expect(p.id.length).toBeGreaterThanOrEqual(24)
    expect(collectPairing(p.id, now)).toEqual({ status: "pending" })
    approvePairing(findPairing({ code: `${p.code.slice(0, 3)} ${p.code.slice(3)}` }, now)!, "618897639836090398")
    expect(collectPairing(p.id, now)).toEqual({ status: "approved", stewardId: "618897639836090398" })
    expect(collectPairing(p.id, now)).toEqual({ status: "expired" })
  })

  test("a pairing lasts ten minutes; unknown ids and codes find nothing", () => {
    const now = Date.now()
    const p = createPairing(now)!
    expect(findPairing({ id: p.id }, now + PAIRING_TTL_MS + 1)).toBeNull()
    expect(findPairing({ id: "nope" }, now)).toBeNull()
    expect(findPairing({ code: "12" }, now)).toBeNull()
  })
})
