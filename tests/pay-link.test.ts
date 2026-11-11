import { describe, expect, test } from "@jest/globals"

import { epcQrPayload } from "@/lib/bank-details"
import { freeCommunication, parseAmount, parsePayRequest, structuredCommunication } from "@/lib/pay-link"

describe("/pay: a transfer filled in from a link", () => {
  test("the amount: euros and cents, nothing silly", () => {
    expect(parseAmount("100.50")).toBe(100.5)
    expect(parseAmount("1512.5")).toBe(1512.5)
    expect(parseAmount("100,50")).toBe(100.5)
    expect(parseAmount("75")).toBe(75)
    for (const bad of [undefined, "", "0", "0.00", "-5", "1e5", "12.345", "1000000", "abc", "10 000", "€10"]) expect(parseAmount(bad)).toBeNull()
  })

  test("a Belgian structured communication, however it arrives, when its check digits hold", () => {
    const ok = "+++000/0001/70152+++"
    for (const raw of [ok, "   000/0001/70152   ", "000/0001/70152", "000000170152", "***000/0001/70152***", " 000 0001 70152 "]) expect(structuredCommunication(raw)).toBe(ok)
    expect(structuredCommunication("+++000/0001/70153+++")).toBeNull()
    expect(structuredCommunication("MEM/2025/00056")).toBeNull()
    expect(structuredCommunication("1234567890123")).toBeNull()
    // 97 stands for a remainder of 0.
    expect(structuredCommunication("000000009797")).toBe("+++000/0000/09797+++")
  })

  test("free text: one line of bank-safe characters, capped", () => {
    expect(freeCommunication("MEM/2025/00056")).toBe("MEM/2025/00056")
    expect(freeCommunication("2026_RCC_35")).toBe("2026_RCC_35")
    expect(freeCommunication(" <script>alert(1)</script>\nInvoice  é 12 ")).toBe("scriptalert(1)/script Invoice e 12")
    expect(freeCommunication("x".repeat(500))).toHaveLength(140)
  })

  test("communication or its synonym description; the structured one goes in the QR's structured field, alone", () => {
    const s = parsePayRequest({ amount: "1512.50", communication: "+++000/0001/70152+++" })
    expect(s).toEqual({ amount: 1512.5, structured: "+++000/0001/70152+++", message: "" })
    const lines = epcQrPayload(s.amount ?? undefined, s.message, s.structured ?? undefined).split("\n")
    expect(lines[7]).toBe("EUR1512.50")
    expect(lines[9]).toBe("+++000/0001/70152+++")
    expect(lines[10]).toBe("")

    const f = parsePayRequest({ amount: "544.50", description: "MEM/2025/00056" })
    expect(f).toEqual({ amount: 544.5, structured: null, message: "MEM/2025/00056" })
    const free = epcQrPayload(f.amount ?? undefined, f.message, undefined).split("\n")
    expect(free[9]).toBe("")
    expect(free[10]).toBe("MEM/2025/00056")

    expect(parsePayRequest({ communication: ["A", "B"] })).toEqual({ amount: null, structured: null, message: "A" })
    expect(epcQrPayload(undefined, "").split("\n")[7]).toBe("")
  })
})
