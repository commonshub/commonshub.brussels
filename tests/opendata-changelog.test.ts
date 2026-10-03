import { describe, expect, test } from "@jest/globals"
import { changelogAtom, changelogJson, changelogMarkdown, OPENDATA_CHANGELOG } from "@/lib/opendata-changelog"
import { resolveOpendata } from "@/lib/opendata"

const BASE = "https://commonshub.brussels"

describe("open-data changelog", () => {
  test("entries are newest first, with unique ids and valid dates", () => {
    const dates = OPENDATA_CHANGELOG.map((e) => e.date)
    expect([...dates].sort().reverse()).toEqual(dates)
    expect(new Set(OPENDATA_CHANGELOG.map((e) => e.id)).size).toBe(OPENDATA_CHANGELOG.length)
    for (const d of dates) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test("placeholders are filled in every format", () => {
    for (const out of [changelogMarkdown(BASE), JSON.stringify(changelogJson(BASE)), changelogAtom(BASE)]) {
      expect(out).not.toContain("{api}")
      expect(out).not.toContain("{base}")
    }
    expect(changelogMarkdown(BASE)).toContain("**Changed · breaking**")
  })

  test("the Atom feed is well formed enough for readers: escaped, one entry per change", () => {
    const atom = changelogAtom(BASE)
    expect(atom.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true)
    expect(atom.match(/<entry>/g)).toHaveLength(OPENDATA_CHANGELOG.length)
    expect(atom).not.toMatch(/<content type="text">[^<]*<(?!\/content>)/)
  })

  test("served under /opendata/changelog.{md,json,xml}", () => {
    expect(resolveOpendata(["changelog.md"])).toEqual({ kind: "changelog", format: "md" })
    expect(resolveOpendata(["changelog.json"])).toEqual({ kind: "changelog", format: "json" })
    expect(resolveOpendata(["changelog.xml"])).toEqual({ kind: "changelog", format: "xml" })
    expect(resolveOpendata(["changelog.html"])).toBeNull()
  })
})
