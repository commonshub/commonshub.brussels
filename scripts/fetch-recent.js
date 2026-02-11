/**
 * Fetch data for current and previous month only
 * This makes builds much faster by not fetching all historical data
 *
 * Usage: node scripts/fetch-recent.js
 */

const { execSync } = require("child_process");

// Calculate current and previous month
const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

const prevDate = new Date(now);
prevDate.setMonth(prevDate.getMonth() - 1);
const previousMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

const monthArgs = `--start-month=${previousMonth} --end-month=${currentMonth}`;

console.log(`\n📅 Fetching data for recent months: ${previousMonth} to ${currentMonth}\n`);

// List of scripts to run with month filtering
const scripts = [
  { name: "transactions", cmd: `tsx scripts/warmup-transactions-cache.js ${monthArgs}` },
  { name: "discord", cmd: `tsx scripts/warmup-discord-cache.js ${monthArgs}` },
  { name: "tokens", cmd: `tsx scripts/fetch-cht-tokens.ts ${monthArgs}` },
  { name: "calendars", cmd: `tsx scripts/fetch-calendars.ts ${monthArgs}` },
  { name: "users", cmd: `tsx scripts/warmup-users-cache.ts ${monthArgs}` },
  { name: "members", cmd: `tsx scripts/fetch-members.ts --month=${currentMonth}` },
];

// Run each script sequentially
for (const script of scripts) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`▶ Running: ${script.name}`);
  console.log(`${"=".repeat(60)}\n`);

  try {
    execSync(script.cmd, { stdio: "inherit" });
  } catch (error) {
    console.error(`\n✗ Error running ${script.name}`);
    process.exit(1);
  }
}

console.log(`\n${"=".repeat(60)}`);
console.log("✓ All recent data fetched successfully!");
console.log(`${"=".repeat(60)}\n`);

// Generate aggregated data from fetched data
console.log(`\n${"=".repeat(60)}`);
console.log("▶ Generating aggregated data files...");
console.log(`${"=".repeat(60)}\n`);

try {
  execSync("tsx scripts/generate-data-files.ts", { stdio: "inherit" });
} catch (error) {
  console.error("\n✗ Error generating data files");
  process.exit(1);
}

console.log(`\n${"=".repeat(60)}`);
console.log("✓ Data fetching and generation complete!");
console.log(`${"=".repeat(60)}\n`);
