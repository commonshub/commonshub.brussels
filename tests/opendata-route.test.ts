/**
 * @jest-environment node
 */

import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

function write(dataDir: string, rel: string, content: string) {
  const full = path.join(dataDir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

describe("/opendata", () => {
  let dataDir: string;
  const previous = process.env.DATA_DIR;
  let GET: typeof import("@/app/opendata/[[...path]]/route").GET;

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "opendata-"));
    write(dataDir, "2026/09/public/expenses.json", '{"scope":"month"}');
    write(dataDir, "2026/09/public/contributors.json", '{"contributors":[]}');
    write(dataDir, "2026/09/public/images.json", '{"images":[]}');
    write(dataDir, "2026/09/public/events/images/evt-1.png", "png");
    write(dataDir, "2026/09/members/expenses.json", '{"names":"Jane"}');
    write(dataDir, "2026/09/stewards/expenses.json", '{"iban":"x"}');
    write(dataDir, "2026/09/hashes.json", '{"hash":"abc"}');
    write(dataDir, "2026/public/vendors.json", '{"scope":"year"}');
    write(dataDir, "2026/vat.json", '{"periods":[]}');
    write(dataDir, "latest/public/pending-bills.json", '{"bills":[]}');
    jest.resetModules();
    process.env.DATA_DIR = dataDir;
    ({ GET } = await import("@/app/opendata/[[...path]]/route"));
  });

  afterAll(() => {
    process.env.DATA_DIR = previous;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const get = (...segments: string[]) =>
    GET(new Request(`http://localhost/opendata/${segments.join("/")}`) as never, {
      params: Promise.resolve({ path: segments.length ? segments : undefined }),
    });

  it("serves the skill at the root", async () => {
    for (const res of [await get(), await get("SKILL.md")]) {
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/markdown");
      const text = await res.text();
      expect(text).toMatch(/^---\nname: commonshub-opendata/);
      expect(text).toContain("/opendata/{YYYY}/{MM}");
    }
  });

  it("serves allowed files from the public tier and the manifests", async () => {
    const cases: Array<[string[], string]> = [
      [["2026", "09", "expenses.json"], '{"scope":"month"}'],
      [["2026", "09", "hashes.json"], '{"hash":"abc"}'],
      [["2026", "vendors.json"], '{"scope":"year"}'],
      [["2026", "vat.json"], '{"periods":[]}'],
      [["latest", "pending-bills.json"], '{"bills":[]}'],
      [["2026", "09", "events", "images", "evt-1.png"], "png"],
    ];
    for (const [segments, body] of cases) {
      const res = await get(...segments);
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(await res.text()).toBe(body);
    }
  });

  it("never serves other tiers, excluded files, or escapes", async () => {
    const refused = [
      ["2026", "09", "members", "expenses.json"],
      ["2026", "09", "stewards", "expenses.json"],
      ["2026", "09", "contributors.json"],
      ["2026", "09", "images.json"],
      ["2026", "09", "..", "09", "stewards", "expenses.json"],
      ["2026", "09", "providers", "odoo", "bills.json"],
      ["generated", "transactions.json"],
      ["2026", "09", "events", "images", "x.json"],
    ];
    for (const segments of refused) {
      const res = await get(...segments);
      expect(res.status).toBe(404);
      expect(await res.text()).not.toMatch(/Jane|iban/);
    }
  });

  it("lists a period and the index with allowed files only", async () => {
    const listing = await (await get("2026", "09")).json();
    expect(listing.files.map((f: { file: string }) => f.file)).toEqual(["expenses.json", "hashes.json"]);
    const index = await (await get("index.json")).json();
    expect(index.periods).toEqual([
      expect.objectContaining({ year: "2026", months: [expect.objectContaining({ month: "09" })] }),
    ]);
    expect((await get("2025", "01")).status).toBe(404);
  });
});
