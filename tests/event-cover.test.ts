/**
 * @jest-environment node
 *
 * A cover that the image proxy will not serve must never reach a card:
 * that is what put broken images on the homepage when chb's October
 * events still pointed at the pre-tier `generated/` directory, and again
 * when chb rewrote the paths to the public tier before downloading the
 * files there.
 */
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals"
import fs from "fs"
import os from "os"
import path from "path"
import { coverUrlFor, localCoverUrl } from "@/lib/event-cover"

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "chb-covers-"))
const REMOTE = "https://images.lumacdn.com/uploads/dz/cover.png"

beforeAll(() => {
  const dir = path.join(tmp, "2026", "10", "public", "events", "images")
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, "evt-1.jpg"), "jpg")
  const legacy = path.join(tmp, "2026", "10", "generated", "events", "images")
  fs.mkdirSync(legacy, { recursive: true })
  fs.writeFileSync(path.join(legacy, "evt-2.jpg"), "jpg")
})

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))

describe("event covers", () => {
  it("serves the local copy when the proxy would serve it", () => {
    expect(localCoverUrl("2026/10/public/events/images/evt-1.jpg", tmp)).toBe("/data/2026/10/public/events/images/evt-1.jpg")
  })

  it("refuses a pre-tier generated/ path even when the file is there", () => {
    expect(localCoverUrl("2026/10/generated/events/images/evt-2.jpg", tmp)).toBeNull()
  })

  it("refuses a public path whose file chb has not downloaded yet", () => {
    expect(localCoverUrl("2026/10/public/events/images/evt-404.jpg", tmp)).toBeNull()
  })

  it("falls back to the platform cover, and to nothing when that is unusable", () => {
    expect(coverUrlFor({ coverImageLocal: "2026/10/generated/events/images/evt-2.jpg", coverImage: REMOTE }, tmp)).toBe(REMOTE)
    expect(coverUrlFor({ coverImageLocal: "2026/10/public/events/images/evt-1.jpg", coverImage: REMOTE }, tmp)).toBe("/data/2026/10/public/events/images/evt-1.jpg")
    expect(coverUrlFor({ coverImage: REMOTE }, tmp)).toBe(REMOTE)
    expect(coverUrlFor({ coverImageLocal: "../etc/passwd.png" }, tmp)).toBe("")
    expect(coverUrlFor({}, tmp)).toBe("")
  })
})
