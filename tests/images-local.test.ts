/**
 * @jest-environment node
 */
import fs from "fs"
import os from "os"
import path from "path"
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals"
import { withLocalImages } from "@/app/api/images/route"

describe("images API serves local copies", () => {
  let dataDir: string
  beforeAll(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "images-"))
    fs.mkdirSync(path.join(dataDir, "2026/08/providers/discord/images"), { recursive: true })
    fs.writeFileSync(path.join(dataDir, "2026/08/providers/discord/images/111.jpg"), "x")
  })
  afterAll(() => fs.rmSync(dataDir, { recursive: true, force: true }))

  test("an expired Discord link is replaced by the file chb downloaded", () => {
    const out = withLocalImages(
      {
        images: [
          { id: "111", url: "https://cdn.discordapp.com/attachments/1/111/a.jpg?ex=1", filePath: "2026/08/providers/discord/images/111.jpg" },
          { id: "222", url: "https://cdn.discordapp.com/attachments/1/222/b.jpg?ex=1", filePath: "2026/08/providers/discord/images/222.jpg" },
        ],
      },
      dataDir,
    )
    expect(out.images[0].url).toBe("/data/2026/08/providers/discord/images/111.jpg")
    expect(out.images[0].sourceUrl).toMatch(/^https:\/\/cdn\.discordapp\.com/)
    expect(out.images[1].url).toMatch(/^https:\/\/cdn\.discordapp\.com/)
  })
})
