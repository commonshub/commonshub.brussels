/**
 * Migration script: move data/{year}/{month}/discord/ to data/{year}/{month}/channels/discord/
 * Also handles data/latest/discord/ -> data/latest/channels/discord/
 *
 * Usage: bun run migrate-discord-to-channels
 *
 * This is safe to run multiple times - it skips directories that have already been migrated.
 */

import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || "data";

let migrated = 0;
let skipped = 0;

function migrateDirectory(dir: string): void {
  if (!fs.existsSync(dir)) {
    return;
  }

  const parent = path.dirname(dir);
  const target = path.join(parent, "channels", "discord");

  if (fs.existsSync(target)) {
    console.log(`SKIP: ${target} already exists`);
    skipped++;
    return;
  }

  // Create channels directory
  fs.mkdirSync(path.join(parent, "channels"), { recursive: true });

  // Move discord to channels/discord
  fs.renameSync(dir, target);
  console.log(`MOVED: ${dir} -> ${target}`);
  migrated++;
}

// Find all year/month directories with discord subdirectories
const dataPath = path.resolve(DATA_DIR);

if (fs.existsSync(dataPath)) {
  const entries = fs.readdirSync(dataPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const yearOrLatest = entry.name;
    const yearPath = path.join(dataPath, yearOrLatest);

    if (yearOrLatest === "latest") {
      // Handle data/latest/discord/
      const discordDir = path.join(yearPath, "discord");
      migrateDirectory(discordDir);
    } else if (/^\d{4}$/.test(yearOrLatest)) {
      // Handle data/{year}/{month}/discord/
      const monthEntries = fs.readdirSync(yearPath, { withFileTypes: true });

      for (const monthEntry of monthEntries) {
        if (!monthEntry.isDirectory()) continue;
        if (!/^\d{2}$/.test(monthEntry.name)) continue;

        const discordDir = path.join(yearPath, monthEntry.name, "discord");
        migrateDirectory(discordDir);
      }
    }
  }
}

console.log("");
console.log(`Migration complete: ${migrated} moved, ${skipped} skipped`);
