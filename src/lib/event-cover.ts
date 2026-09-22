/**
 * Which cover image an event actually gets.
 *
 * chb downloads event covers into the public tier
 * (`YYYY/MM/public/events/images/<id>.<ext>`) and writes that path into
 * `coverImageLocal`. Two things can make that path unusable, and both have
 * happened: it still points at the pre-tier `generated/` directory, which
 * the image proxy refuses (it is not a served surface), or it points at the
 * public tier before `chb images sync` has put the bytes there — chb
 * rewrites the path for a month it has not downloaded yet.
 *
 * Either way the card rendered a broken image. So: use the local copy only
 * when the proxy would really serve it, otherwise fall back to the cover on
 * the event platform, and to nothing at all rather than to a URL the proxy
 * will refuse.
 */

import * as fs from "fs"
import * as path from "path"
import { DATA_DIR } from "./data-paths"
import { isProxyableImageUrl } from "./image-proxy-server"
import { isServableDataPath } from "./served-paths"

/** `/data/<rel>` when the proxy will serve that file, else null. */
export function localCoverUrl(relativePath?: string, dataDir: string = DATA_DIR): string | null {
  if (!relativePath || !isServableDataPath(relativePath)) return null
  return fs.existsSync(path.join(dataDir, relativePath)) ? `/data/${relativePath}` : null
}

/** The best usable cover for an event: the local copy, the remote one, or "". */
export function coverUrlFor(
  event: { coverImageLocal?: string; coverImage?: string; cover_url?: string },
  dataDir: string = DATA_DIR,
): string {
  const local = localCoverUrl(event.coverImageLocal, dataDir)
  if (local) return local
  const remote = event.coverImage || event.cover_url || ""
  return isProxyableImageUrl(remote) ? remote : ""
}
