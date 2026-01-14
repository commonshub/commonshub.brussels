#!/usr/bin/env tsx
/**
 * Fetch and generate all data for a specific month
 *
 * Usage:
 *   npm run fetch-data -- --data-dir tests/data --year 2025 --month 11
 *   npm run fetch-data -- --year 2025 --month 11
 *   npm run fetch-data -- --month 11  # defaults to current year
 *   npm run fetch-data -- --month 11 --force  # re-fetch even if data exists
 *
 * Options:
 *   --data-dir DIR   Output directory (default: ./data)
 *   --year YYYY      Year to fetch (default: current year)
 *   --month MM       Month to fetch (default: current month)
 *   --force          Re-fetch data even if it already exists
 *
 * This script will:
 * 1. Fetch calendars (iCal + Luma)
 * 2. Generate events.json
 * 3. Download featured images
 * 4. Fetch CHT tokens
 * 5. Generate data files (contributors, etc.)
 * 6. Generate transactions
 */

import { spawn } from "child_process";
import * as path from "path";

interface Args {
  dataDir: string;
  year: string;
  month: string;
  force: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): Args {
  const args = process.argv.slice(2);

  let dataDir = path.join(process.cwd(), "data");
  let year = new Date().getFullYear().toString();
  let month = (new Date().getMonth() + 1).toString().padStart(2, "0");
  let force = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--data-dir" && args[i + 1]) {
      dataDir = path.resolve(args[i + 1]);
      i++;
    } else if (arg.startsWith("--data-dir=")) {
      dataDir = path.resolve(arg.split("=")[1]);
    } else if (arg === "--year" && args[i + 1]) {
      year = args[i + 1];
      i++;
    } else if (arg.startsWith("--year=")) {
      year = arg.split("=")[1];
    } else if (arg === "--month" && args[i + 1]) {
      month = args[i + 1].padStart(2, "0");
      i++;
    } else if (arg.startsWith("--month=")) {
      month = arg.split("=")[1].padStart(2, "0");
    } else if (arg === "--force") {
      force = true;
    }
  }

  return { dataDir, year, month, force };
}

/**
 * Run a command with environment variables
 */
function runCommand(
  command: string,
  args: string[],
  env: Record<string, string> = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n📦 Running: ${command} ${args.join(" ")}`);
    console.log(`   DATA_DIR=${env.DATA_DIR || path.join(process.cwd(), "data")}\n`);

    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, ...env },
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}: ${command} ${args.join(" ")}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Main function
 */
async function main() {
  const { dataDir, year, month, force } = parseArgs();
  const monthKey = `${year}-${month}`;

  console.log("🚀 Fetching all data for:");
  console.log(`   Year: ${year}`);
  console.log(`   Month: ${month}`);
  console.log(`   Data directory: ${dataDir}`);
  if (force) {
    console.log(`   Mode: FORCE (will re-fetch existing data)`);
  }
  console.log("");

  const env = { DATA_DIR: dataDir };

  try {
    // 1. Fetch calendars (iCal + Luma)
    console.log("📅 Step 1/7: Fetching calendars...");
    const calendarArgs = ["tsx", "scripts/fetch-calendars.ts", `--month=${monthKey}`];
    if (force) calendarArgs.push("--force");
    await runCommand("npx", calendarArgs, env);

    // 2. Generate events.json
    console.log("\n🎉 Step 2/7: Generating events...");
    await runCommand("npx", ["tsx", "scripts/generate-events.ts"], env);

    // 3. Download featured images
    console.log("\n🖼️  Step 3/7: Downloading featured images...");
    await runCommand("npx", ["tsx", "scripts/download-featured-images.ts", year], env);

    // 4. Fetch blockchain transactions (Gnosis/EURe, EURb, etc.)
    console.log("\n⛓️  Step 4/7: Fetching blockchain transactions...");
    await runCommand("npx", ["tsx", "scripts/warmup-transactions-cache.js", `--month=${monthKey}`], env);

    // 5. Fetch CHT tokens
    console.log("\n🪙 Step 5/7: Fetching CHT tokens...");
    const chtArgs = ["tsx", "scripts/fetch-cht-tokens.ts", year, month];
    if (force) chtArgs.push("--force");
    await runCommand("npx", chtArgs, env);

    // 6. Generate data files (contributors, etc.)
    console.log("\n👥 Step 6/7: Generating data files...");
    await runCommand("npx", ["tsx", "scripts/generate-data-files.ts"], env);

    // 7. Generate transactions
    console.log("\n💰 Step 7/7: Generating transactions...");
    await runCommand("npx", ["tsx", "scripts/generate-transactions.ts"], env);

    console.log("\n✅ All data fetched and generated successfully!");
    console.log(`📁 Data directory: ${dataDir}`);

  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
