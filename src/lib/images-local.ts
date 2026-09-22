/**
 * Discord attachment links are signed and expire after a day, so a month-old
 * `url` is dead. chb downloads every attachment; point at that copy when it
 * is there (served through /api/image-proxy), and only fall back to Discord.
 * Kept free of auth imports so tests can load it without next-auth.
 */
import * as fs from "fs"
import * as path from "path"
import { DATA_DIR } from "./data-paths"
import { getLocalImagePath } from "./discord-cache"

interface ImageRecord {
  id?: string
  url: string
  /** Where chb saved the file, relative to DATA_DIR. */
  filePath?: string
  /** The Discord link the local copy replaced. */
  sourceUrl?: string
  timestamp?: string
  [key: string]: unknown
}

export function withLocalImages<T extends { images?: ImageRecord[] }>(data: T, dataDir = DATA_DIR): Omit<T, "images"> & { images: ImageRecord[] } {
  const images = (data.images ?? []).map((image) => {
    const local =
      (image.filePath && fs.existsSync(path.join(dataDir, image.filePath)) ? `/data/${image.filePath}` : null) ??
      (image.id && image.timestamp ? getLocalImagePath(image.id, image.url, image.timestamp) : null)
    return local ? { ...image, url: local, sourceUrl: image.url } : image
  })
  return { ...data, images }
}
