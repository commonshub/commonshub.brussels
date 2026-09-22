/**
 * @jest-environment node
 *
 * The dataset chb mounts at DATA_DIR has three audience tiers —
 * YYYY/MM/{public,members,stewards}/ (and the same under YYYY/ and latest/).
 * The site reads exactly one tier per viewer through `tierDir()`; it never
 * opens the pipeline's own directories, because those hold what the tiers
 * deliberately leave out (wallets, emails, raw exports). A page that could
 * reach them by path is a leak waiting for a typo, so the source tree must
 * not spell those paths at all. Design: github.com/commonshub/chb/docs/audiences.md.
 */

import fs from "fs";
import path from "path";
import { describe, expect, test } from "@jest/globals";

const SRC = path.join(__dirname, "..", "src");

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (/\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

const rel = (file: string) => path.relative(SRC, file).split(path.sep).join("/");

/** Code lines only: comments are documentation, not reads. */
function codeLines(source: string): string[] {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"));
}

/**
 * Files allowed to name a directory the tiers do not expose, each with the
 * reason it is safe. Anything else naming one is an offender.
 */
const ALLOWED: Record<string, string> = {
  // Rejects these segments in a URL so the data browser cannot be pointed at them.
  "app/data/[[...path]]/route.ts": "guard list",
  // Rejects these segments in a dataset path before serving a membership file.
  "lib/membership.ts": "guard list",
  // Serves exactly YYYY/MM/providers/discord/images/<file> and nothing else under providers/.
  "lib/served-paths.ts": "image allow-list",
  // Resolves a Discord attachment to that same served path.
  "lib/discord-cache.ts": "attachment lookup",
  // Declares the tier names.
  "lib/data-paths.ts": "tier definitions",
};

// A string literal that is, or contains as a path segment, one of the
// directories the site must not read.
const FORBIDDEN = /["'`](?:[^"'`]*\/)?(generated|private|stewards|providers)(?:\/[^"'`]*)?["'`]/;
// Only lines that touch the filesystem count: a module specifier or a page
// link that happens to contain one of the words is not a read.
const TOUCHES_FS = /\b(join|resolve|existsSync|readFileSync|readdirSync|statSync|DATA_DIR|dataDir|tierDir|tierFile)\b/;

describe("the site reads audience tiers only", () => {
  test("no source names generated/, private/, stewards/ or providers/ as a path", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const name = rel(file);
      if (ALLOWED[name]) continue;
      codeLines(fs.readFileSync(file, "utf-8")).forEach((line, i) => {
        if (!line.trim().startsWith("import") && TOUCHES_FS.test(line) && FORBIDDEN.test(line)) offenders.push(`${name}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  test("the allow-listed files still exist (prune the list when one goes)", () => {
    for (const name of Object.keys(ALLOWED)) {
      expect(fs.existsSync(path.join(SRC, name))).toBe(true);
    }
  });

  test("no source builds a dataset path from process.cwd()/data", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => rel(file) !== "lib/data-paths.ts")
      .filter((file) => /process\.cwd\(\),\s*["']data["']/.test(fs.readFileSync(file, "utf-8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  test("the legacy top-level layouts are gone", () => {
    const legacy = [/["']sources["'],\s*["']discord["']/, /DATA_DIR,\s*year,\s*month,\s*["']messages["']/, /["']channels["'],\s*["']discord["']/, /["']finance["'],\s*["']odoo["']/];
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const source = fs.readFileSync(file, "utf-8");
      for (const pattern of legacy) if (pattern.test(source)) offenders.push(`${rel(file)}: ${pattern}`);
    }
    expect(offenders).toEqual([]);
  });
});
