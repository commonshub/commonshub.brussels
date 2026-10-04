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

  test("partners on two levels; nothing overlaps, everything on screen, clear of the logo and the corners", () => {
    const points = membersCloud(22, 77)
    expect(points).toHaveLength(99)
    const px = points.map((p, i) => ({ x: (p.x / 100) * 1920, y: (p.y / 100) * 1080, r: ((i < 22 ? 5.4 : 3.15) * 19.2) / 2 }))
    for (let i = 0; i < px.length; i++)
      for (let j = i + 1; j < px.length; j++) expect(Math.hypot(px[i].x - px[j].x, px[i].y - px[j].y)).toBeGreaterThan(px[i].r + px[j].r)
    for (const p of px) {
      expect(Math.min(p.x - p.r, 1920 - p.x - p.r, p.y - p.r, 1080 - p.y - p.r)).toBeGreaterThanOrEqual(0)
      expect(Math.hypot(p.x - 960, p.y - 540) - p.r).toBeGreaterThan(8.5 * 19.2) // the logo
    }
    // Two levels: alternate partners sit on an inner and an outer curve.
    const dist = (p: { x: number; y: number }) => Math.hypot((p.x - 50) / 48, (p.y - 50) / 46)
    for (let i = 0; i + 1 < 22; i += 2) expect(dist(points[i])).toBeLessThan(dist(points[i + 1]))
  })
})
