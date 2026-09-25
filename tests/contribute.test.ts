import { describe, expect, test } from "@jest/globals"
import {
  MIN_CONTRIBUTION_EUR,
  clampContribution,
  contributionMessage,
  contributionStep,
  defaultContribution,
  maxContribution,
} from "@/lib/contribute"
import { epcQrPayload } from "@/lib/bank-details"

describe("contribution amounts", () => {
  test("defaults to half the expense", () => {
    expect(defaultContribution(1500)).toBe(750)
    expect(defaultContribution(89.9)).toBe(45)
  })

  test("never asks for less than the minimum", () => {
    expect(defaultContribution(12)).toBe(MIN_CONTRIBUTION_EUR)
    expect(defaultContribution(3)).toBe(MIN_CONTRIBUTION_EUR)
    expect(maxContribution(3)).toBe(MIN_CONTRIBUTION_EUR)
  })

  test("the slider tops out at the whole expense", () => {
    expect(maxContribution(1234.56)).toBe(1235)
    expect(maxContribution(50_000)).toBe(10_000)
  })

  test("typed values are clamped and rounded", () => {
    expect(clampContribution(2, 500)).toBe(MIN_CONTRIBUTION_EUR)
    expect(clampContribution(999, 500)).toBe(500)
    expect(clampContribution(33.7, 500)).toBe(34)
    expect(clampContribution(Number.NaN, 500)).toBe(250)
  })

  test("step grows with the bill", () => {
    expect(contributionStep(80)).toBe(1)
    expect(contributionStep(800)).toBe(5)
    expect(contributionStep(8000)).toBe(10)
  })
})

describe("transfer message", () => {
  test("is short: the cost's short name, or the bill reference", () => {
    expect(contributionMessage("phone booth")).toBe("Contribution phone booth")
    expect(contributionMessage("BILL/2026/0042")).toBe("Contribution BILL/2026/0042")
  })

  test("stays within SEPA's 140 characters", () => {
    const message = contributionMessage("x".repeat(300))
    expect(message.length).toBeLessThanOrEqual(140)
    expect(message.startsWith("Contribution x")).toBe(true)
  })

  test("ends up in the QR payload with the amount", () => {
    const lines = epcQrPayload(75, "Contribution BILL/2026/0042 - Rent").split("\n")
    expect(lines[7]).toBe("EUR75.00")
    expect(lines[10]).toBe("Contribution BILL/2026/0042 - Rent")
  })

  test("the general donation payload is unchanged", () => {
    const lines = epcQrPayload().split("\n")
    expect(lines[7]).toBe("")
    expect(lines[10]).toBe("Donation for the Commons Hub Brussels")
  })
})
