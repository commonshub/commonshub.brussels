/**
 * Fetch all historical data
 * This should be run manually when you want to populate all historical months
 *
 * Usage: node scripts/fetch-history.js
 *
 * Optional: Specify a date range
 *   node scripts/fetch-history.js --start-month=2024-01 --end-month=2024-12
 */

const { execSync } = require("child_process");

// Get month range from command line arguments
const args = process.argv.slice(2).join(" ");
const monthFilter = args || "(all months)";

console.log(`\n📅 Fetching historical data: ${monthFilter}\n`);
console.log("⚠️  Warning: This may take a long time for the first run!\n");

// List of scripts to run
const scripts = [
  { name: "transactions", cmd: `tsx scripts/warmup-transactions-cache.js ${args}` },
  { name: "discord", cmd: `tsx scripts/warmup-discord-cache.js ${args}` },
  { name: "tokens", cmd: `tsx scripts/fetch-cht-tokens.ts ${args}` },
  { name: "calendars", cmd: `tsx scripts/fetch-calendars.ts ${args}` },
  { name: "users", cmd: `tsx scripts/warmup-users-cache.ts ${args}` },
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
console.log("✓ All historical data fetched successfully!");
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
