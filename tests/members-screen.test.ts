import { describe, expect, test } from "@jest/globals"
import { ellipsePoints, memberAvatars, membersCloud, partnerLogos } from "@/lib/members-screen"

const file = (contributors: object[]) => ({ contributors }) as never

describe("members screen", () => {
  test("members: once each, with an avatar, most active first, bots and the hub's account left out", () => {
    const items = memberAvatars([
      file([
        { id: "1", username: "ada", displayName: "Ada", avatar: "https://cdn/a.png", contributionCount: 5 },
        { id: "2", username: "bob", displayName: "Bob", avatar: null, contributionCount: 50 },
        { id: "3", username: "opencollective", displayName: "Open Collective", avatar: "https://cdn/oc.png", contributionCount: 99 },
      ]),
      file([
        { id: "1", username: "ada", displayName: "Ada", avatar: "https://cdn/a2.png", contributionCount: 10 },
        { id: "4", username: "cy", displayName: "Cy", avatar: "https://cdn/c.png", contributionCount: 12 },
      ]),
    ])
    expect(items.map((i) => i.name)).toEqual(["Ada", "Cy"])
    expect(items[0]).toMatchObject({ kind: "member", image: "https://cdn/a2.png" })
  })

  test("partners come from settings, each with a logo", () => {
    const partners = partnerLogos()
    expect(partners.length).toBeGreaterThan(0)
    for (const p of partners) expect(p.image).toMatch(/^\//)
  })

  test("the cloud stays on screen and around the logo", () => {
    const points = membersCloud(22, 77)
    expect(points).toHaveLength(99)
    for (const { x, y } of points) {
      expect(x).toBeGreaterThanOrEqual(1)
      expect(x).toBeLessThanOrEqual(99)
      expect(y).toBeGreaterThanOrEqual(3)
      expect(y).toBeLessThanOrEqual(97)
      // outside the logo's free circle (about 15% of the width / 30% of the height around the centre)
      expect(Math.hypot((x - 50) / 48, (y - 50) / 46)).toBeGreaterThan(0.5)
    }
    expect(ellipsePoints(0, 0.5)).toEqual([])
  })
})
