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
