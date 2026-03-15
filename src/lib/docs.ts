import { readFileSync, existsSync } from "fs";
import { join } from "path";

const DOCS_DIR = join(process.cwd(), "docs");

export function getDoc(path: string): string | null {
  const filePath = join(DOCS_DIR, path);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf-8");
}

export function getDocTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : "Documentation";
}

export const CLI_COMMANDS = [
  { slug: "events", title: "Events", description: "List and sync events from Luma" },
  { slug: "transactions", title: "Transactions", description: "Sync blockchain + Stripe transactions" },
  { slug: "messages", title: "Messages", description: "Sync Discord channel messages" },
  { slug: "bookings", title: "Bookings", description: "List and sync room bookings" },
  { slug: "rooms", title: "Rooms", description: "List rooms and pricing" },
  { slug: "report", title: "Report", description: "Generate monthly/yearly reports" },
] as const;
