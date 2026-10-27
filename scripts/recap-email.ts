/**
 * Render a member's monthly email to files, to look at or send by hand:
 *   DATA_DIR=… bun scripts/recap-email.ts <username> <year> <month> [out-dir]
 * Writes <out>/<username>-<year>-<month>.{html,txt} and prints the subject.
 */
import * as fs from "fs";
import * as path from "path";

import { loadRecap } from "../src/lib/monthly-recap";
import { buildRecapEmail } from "../src/lib/monthly-recap-email";

async function main() {
  const [username, year, month, out = "."] = process.argv.slice(2);
  if (!username || !year || !month) {
    console.error(
      "usage: bun scripts/recap-email.ts <username> <year> <month> [out-dir]",
    );
    process.exit(1);
  }
  const recap = await loadRecap(username, year, month);
  if (!recap) {
    console.error(`No recap for ${username} ${year}-${month}`);
    process.exit(1);
  }
  const { subject, html, text } = buildRecapEmail(recap);
  const base = path.join(out, `${username}-${year}-${month}`);
  fs.writeFileSync(`${base}.html`, html);
  fs.writeFileSync(`${base}.txt`, text);
  console.log(subject);
}

main();
