import { describe, expect, test } from "@jest/globals"
import { isExcludedContributor, publicContributors } from "@/lib/contributors"
import { reportYears } from "@/lib/reports"

describe("contributors shown on /community", () => {
  const file = {
    contributors: [
      { id: "1", username: "jane", displayName: "Jane", avatar: "a.png", contributionCount: 5 },
      { id: "2", username: "opencollective", displayName: "opencollective", avatar: "b.png", contributionCount: 22 },
      { id: "3", username: "sam", displayName: "OpenCollective", avatar: "c.png", contributionCount: 1 },
    ],
    totalMembers: 273,
  }

  test("the Open Collective account is left out, by username or display name", () => {
    const shown = publicContributors(file)
    expect(shown.contributors.map((c) => c.id)).toEqual(["1"])
    expect(shown.totalMembers).toBe(273)
  })

  test("the exclusion list comes from settings and is case-insensitive", () => {
    expect(isExcludedContributor({ username: "OpenCollective", displayName: "x" })).toBe(true)
    expect(isExcludedContributor({ username: "jane", displayName: "Jane" })).toBe(false)
  })
})

describe("report years", () => {
  test("start in 2024, the year the hub opened", () => {
    expect(reportYears(["2023", "2024", "2025", "2026", "generated", "latest"], true, new Date("2026-09-16"))).toEqual([
      "2024",
      "2025",
      "2026",
    ])
  })

  test("future years stay out unless asked for", () => {
    expect(reportYears(["2024", "2027"], true, new Date("2026-09-16"))).toEqual(["2024"])
    expect(reportYears(["2024", "2027"], false, new Date("2026-09-16"))).toEqual(["2024", "2027"])
  })
})
