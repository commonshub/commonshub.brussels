/**
 * @jest-environment jsdom
 */
import React from "react"
import { describe, expect, test } from "@jest/globals"
import { render, screen } from "@testing-library/react"
import { Donors } from "@/components/contribute/donors"
import type { Donor } from "@/lib/donors"

const donor = (i: number): Donor => ({ name: `Donor ${i}`, total: 1000 - i, donations: 1, lastAt: `2026-01-${String((i % 28) + 1).padStart(2, "0")}` })
const largest = Array.from({ length: 25 }, (_, i) => donor(i + 1))
const summary = { donations: 30, latest: [...largest].reverse(), largest }

describe("who already contributed", () => {
  test("members see the latest ten, the largest twenty with the rest behind show more, and the lenders", () => {
    render(<Donors donors={summary} member lenders={["Lender A", "Lender B"]} />)
    const latest = screen.getByText("Latest donors:").parentElement!.textContent!
    expect(latest.split(" · ")).toHaveLength(10)
    const largestP = screen.getByText("All time largest donors:").parentElement!
    expect(largestP.textContent).toContain("Donor 1 · Donor 2")
    expect(screen.getByText("show 5 more")).toBeTruthy()
    expect(screen.getByText("Lender A · Lender B")).toBeTruthy()
    expect(screen.getByRole("link", { name: /See the loans/ }).getAttribute("href")).toBe("/debt")
  })

  test("visitors see the count and the lenders, never a donor's name", () => {
    render(<Donors donors={{ donations: 211, latest: [], largest: [] }} member={false} lenders={["Lender A"]} />)
    expect(screen.queryByText("Latest donors:")).toBeNull()
    expect(screen.getByText("211")).toBeTruthy()
    expect(screen.getByText("Lender A")).toBeTruthy()
  })
})
