/**
 * Render a member's recap email to files, to look at or send by hand:
 *   DATA_DIR=… bun scripts/recap-email.ts <username> <year> [<month>|Q<n>] [out-dir]
 * Without a month it's the year. Writes <out>/<username>-<period>.{html,txt}
 * and prints the subject. With RENEW_LINK_SECRET (or AUTH_SECRET) set, the
 * footer's notification settings link is signed for that member.
 */
import * as fs from "fs"
import * as path from "path"

import { findMember, loadRecap, parsePeriod } from "../src/lib/monthly-recap"
import { buildRecapEmail } from "../src/lib/monthly-recap-email"
import { settingsUrl, signSettingsLink } from "../src/lib/notification-links"

async function main() {
  const [username, year, part, out = "."] = process.argv.slice(2)
  const period = year ? parsePeriod(year, part === "-" ? undefined : part) : null
  if (!username || !period) {
    console.error("usage: bun scripts/recap-email.ts <username> <year> [<month>|Q<n>|-] [out-dir]")
    process.exit(1)
  }
  const recap = await loadRecap(username, period)
  if (!recap) {
    console.error(`No recap for ${username}`)
    process.exit(1)
  }
  const origin = "https://commonshub.brussels"
  let token: string | undefined
  try {
    token = signSettingsLink(findMember(username)!.id)
  } catch {}
  const { subject, html, text } = buildRecapEmail(recap, { origin, settingsLink: settingsUrl(origin, token) })
  const base = path.join(out, `${username}-${period.year}${period.part ? `-${period.part}` : ""}`)
  fs.writeFileSync(`${base}.html`, html)
  fs.writeFileSync(`${base}.txt`, text)
  console.log(subject)
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error)
    process.exit(1)
  },
)
