import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { isAdmin } from "@/lib/admin-check";

interface CounterpartyMetadata {
  description: string;
  type: "organisation" | "individual" | null;
}

interface Counterparty {
  id: string;
  metadata: CounterpartyMetadata;
}

interface CounterpartiesFile {
  month: string;
  generatedAt: string;
  counterparties: Counterparty[];
}

/**
 * Find counterparty file by searching through year/month directories
 */
function findCounterpartyFile(id: string): string | null {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");

  if (!fs.existsSync(dataDir)) {
    return null;
  }

  // Get all year directories
  const yearDirs = fs
    .readdirSync(dataDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && /^\d{4}$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort()
    .reverse(); // Start with most recent year

  for (const year of yearDirs) {
    const yearPath = path.join(dataDir, year);
    const monthDirs = fs
      .readdirSync(yearPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
      .map((dirent) => dirent.name)
      .sort()
      .reverse(); // Start with most recent month

    for (const month of monthDirs) {
      const filePath = path.join(dataDir, year, month, "counterparties.json");
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const data: CounterpartiesFile = JSON.parse(content);

          // Check if counterparty exists in this file
          if (data.counterparties.some((cp) => cp.id === id)) {
            return filePath;
          }
        } catch (error) {
          console.error(`Error reading ${filePath}:`, error);
        }
      }
    }
  }

  return null;
}

/**
 * PATCH /api/counterparties/[id]
 * Update counterparty metadata
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin permission
  const userIsAdmin = await isAdmin();
  if (!userIsAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  // Parse request body
  let metadata: Partial<CounterpartyMetadata>;
  try {
    metadata = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Find the counterparty file
  const filePath = findCounterpartyFile(decodedId);
  if (!filePath) {
    return NextResponse.json(
      { error: "Counterparty not found" },
      { status: 404 }
    );
  }

  try {
    // Read the file
    const content = fs.readFileSync(filePath, "utf-8");
    const data: CounterpartiesFile = JSON.parse(content);

    // Find and update the counterparty
    const cpIndex = data.counterparties.findIndex((cp) => cp.id === decodedId);
    if (cpIndex === -1) {
      return NextResponse.json(
        { error: "Counterparty not found" },
        { status: 404 }
      );
    }

    // Update metadata
    data.counterparties[cpIndex].metadata = {
      ...data.counterparties[cpIndex].metadata,
      ...metadata,
    };

    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      counterparty: data.counterparties[cpIndex],
    });
  } catch (error) {
    console.error("Error updating counterparty:", error);
    return NextResponse.json(
      { error: "Failed to update counterparty" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/counterparties/[id]
 * Get counterparty details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  // Find the counterparty file
  const filePath = findCounterpartyFile(decodedId);
  if (!filePath) {
    return NextResponse.json(
      { error: "Counterparty not found" },
      { status: 404 }
    );
  }

  try {
    // Read the file
    const content = fs.readFileSync(filePath, "utf-8");
    const data: CounterpartiesFile = JSON.parse(content);

    // Find the counterparty
    const counterparty = data.counterparties.find((cp) => cp.id === decodedId);
    if (!counterparty) {
      return NextResponse.json(
        { error: "Counterparty not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ counterparty });
  } catch (error) {
    console.error("Error reading counterparty:", error);
    return NextResponse.json(
      { error: "Failed to read counterparty" },
      { status: 500 }
    );
  }
}
