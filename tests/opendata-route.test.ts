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
  let GET: typeof import("@/app/opendata/[...path]/route").GET;

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
    write(dataDir, "latest/public/pending-bills.json", '{"bills":[],"totals":{"count":2,"amountDue":150}}');
    write(
      dataDir,
      "2026/09/public/transactions.json",
      JSON.stringify({
        transactions: [
          { currency: "EUR", type: "CREDIT", amount: 100, normalizedAmount: 97, metadata: { collective: "commonshub" } },
          { currency: "EURe", type: "MINT", amount: 50, metadata: { collective: "commonshub" } },
          { currency: "EURe", type: "BURN", amount: -30, metadata: { collective: "openletter" } },
          { currency: "EURe", type: "INTERNAL", amount: 25000, metadata: { collective: "commonshub" } },
          { currency: "EURe", type: "TRANSFER", amount: -500, metadata: { collective: "commonshub" } },
          { currency: "CHT", type: "MINT", amount: 10, metadata: { collective: "commonshub" } },
        ],
      })
    );
    write(
      dataDir,
      "2026/09/public/summary.json",
      JSON.stringify({ summary: { events: 1, bookings: 65 }, tokens: [{ symbol: "CHT", minted: 280, burnt: 138.25, totalSupply: 15418.79 }] })
    );
    jest.resetModules();
    process.env.DATA_DIR = dataDir;
    ({ GET } = await import("@/app/opendata/[...path]/route"));
  });

  afterAll(() => {
    process.env.DATA_DIR = previous;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const get = (...segments: string[]) =>
    GET(new Request(`http://localhost/opendata/${segments.join("/")}`) as never, {
      params: Promise.resolve({ path: segments.length ? segments : undefined }),
    });

  it("serves the skill as markdown at /opendata.md and /opendata/SKILL.md", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GET: getMd } = require("@/app/opendata.md/route") as typeof import("@/app/opendata.md/route")
    for (const res of [await getMd(), await get("SKILL.md")]) {
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/markdown");
      const text = await res.text();
      expect(text).toMatch(/^---\nname: commonshub-opendata/);
      expect(text).toContain("/opendata/{YYYY}/{MM}");
      expect(text).toContain("Open Database License (ODbL)");
    }
  });

  it("serves allowed files from the public tier and the manifests", async () => {
    const cases: Array<[string[], string]> = [
      [["2026", "09", "expenses.json"], '{"scope":"month"}'],
      [["2026", "09", "hashes.json"], '{"hash":"abc"}'],
      [["2026", "vendors.json"], '{"scope":"year"}'],
      [["2026", "vat.json"], '{"periods":[]}'],
      [["latest", "pending-bills.json"], '{"bills":[],"totals":{"count":2,"amountDue":150}}'],
      [["2026", "09", "events", "images", "evt-1.png"], "png"],
    ];
    for (const [segments, body] of cases) {
      const res = await get(...segments);
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(res.headers.get("link")).toBe('<https://opendatacommons.org/licenses/odbl/1-0/>; rel="license"');
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

  it("serves a monthly time series that leaves internal transfers out", async () => {
    for (const segments of [["monthly.json"], ["2026", "monthly.json"]]) {
      const res = await get(...segments);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.license).toMatchObject({ id: "ODbL-1.0" });
      expect(body.months).toHaveLength(1);
      const [month] = body.months;
      expect(month.month).toBe("2026-09");
      expect(month.money.eur).toEqual({ in: 147, out: 30, net: 117, transactions: 3 });
      expect(month.money.byCollective.commonshub).toEqual({ in: 147, out: 0, net: 147, transactions: 2 });
      expect(month.money.byCurrency.EURe).toEqual({ in: 50, out: 30, net: 20, transactions: 2 });
      expect(month.activity).toMatchObject({ events: 1, bookings: 65 });
      expect(month.tokens[0]).toMatchObject({ symbol: "CHT", totalSupply: 15418.79 });
      expect(month.expenses).toBeNull();
      expect(month.door).toBeNull();
    }
    expect((await get("2025", "monthly.json")).status).toBe(404);
    expect((await get("2026", "09", "monthly.json")).status).toBe(404);
    const year = await (await get("2026")).json();
    expect(year.files.map((f: { file: string }) => f.file)).toContain("monthly.json");
  });

  it("serves markdown summaries for agents", async () => {
    const { GET: finance } = await import("@/app/finance.md/route");
    const text = await (await finance()).text();
    expect(text).toContain("| 2026-09 | €147.00 | €0.00 | €147.00 | €147.00 | €30.00 |");
    expect(text).toContain("2 bills, €150.00 due");
    const { GET: economy } = await import("@/app/economy.md/route");
    expect(await (await economy()).text()).toContain("| 2026-09 | 280 | 138.25 | 15,418.79 |");
    const { GET: community } = await import("@/app/community.md/route");
    expect(await (await community()).text()).toContain("| 2026-09 | – | – | 1 | 65 | – | – |");
  });

  it("describes data quality from the data: coverage, annotations, upstream bugs", async () => {
    const monthly = await (await get("monthly.json")).json();
    expect(monthly.months[0].notes).toEqual([]);
    expect(monthly.coverage.money).toEqual({ first: "2026-09", everyMonthSince: "2026-09", emptyMonths: 0 });
    expect(monthly.coverage.door).toEqual({ first: null, everyMonthSince: null, emptyMonths: 0 });

    const annotations = await (await get("annotations.json")).json();
    expect(annotations.annotations).toContainEqual(expect.objectContaining({ month: "2025-09", section: "tokens.CHT", kind: "test" }));
    expect(annotations.upstreamIssues.length).toBeGreaterThan(0);

    const skill = await (await get()).text();
    expect(skill).toContain("## Data quality");
    expect(skill).toContain("| money | 2026-09 | 2026-09 | 0 |");
    expect(skill).toContain("| door | never | – | 0 |");
    expect(skill).toContain("**2025-09**, `tokens.CHT` (test)");
  });

  it("uses the annotations chb publishes, on the months they name", async () => {
    write(
      dataDir,
      "latest/public/annotations.json",
      JSON.stringify({ annotations: [{ month: "2026-09", section: "tokens.CHT", kind: "test", note: "A test mint." }] })
    );
    try {
      const monthly = await (await get("monthly.json")).json();
      expect(monthly.months[0].notes).toEqual([{ section: "tokens.CHT", kind: "test", note: "A test mint." }]);
      const annotations = await (await get("annotations.json")).json();
      expect(annotations.annotations).toHaveLength(1);
      const { GET: economy } = await import("@/app/economy.md/route");
      expect(await (await economy()).text()).toContain("- **2026-09**: A test mint.");
    } finally {
      fs.rmSync(path.join(dataDir, "latest/public/annotations.json"));
    }
  });

  it("lists a period and the index with allowed files only", async () => {
    const listing = await (await get("2026", "09")).json();
    expect(listing.files.map((f: { file: string }) => f.file)).toEqual(["expenses.json", "hashes.json", "summary.json", "transactions.json"]);
    const index = await (await get("index.json")).json();
    expect(index.license).toMatchObject({ id: "ODbL-1.0", url: "https://opendatacommons.org/licenses/odbl/1-0/" });
    expect(index.periods).toEqual([
      expect.objectContaining({ year: "2026", months: [expect.objectContaining({ month: "09" })] }),
    ]);
    expect((await get("2025", "01")).status).toBe(404);
  });
});

describe("the skill explains how to contribute back on Nostr", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { opendataSkill } = require("@/lib/opendata-skill") as typeof import("@/lib/opendata-skill")
  const md = opendataSkill("https://commonshub.brussels")

  test("identifiers, event shapes, relay and access", () => {
    expect(md).toContain("## Contribute back: tag, describe and comment (Nostr)")
    for (const needle of ["chb:bill:<id>", "chb:expense:<slug>", "stripe:txn", "iban:tx", '["I", "chb:bill:', "wss://relay.commonshub.brussels", "allow-list"]) {
      expect(md).toContain(needle)
    }
  })

  test("no stale promise that months can be missing", () => {
    expect(md).not.toContain("a month without vendor bills has no")
    expect(md).toContain('"expenses": []')
  })
})
