/**
 * @jest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import fs from "fs";
import os from "os";
import path from "path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "chb-integrity-"));
function writeJson(rel: string, data: unknown) {
  const file = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

let integrity: typeof import("@/lib/integrity");

beforeAll(() => {
  writeJson("latest/public/integrity.json", {
    generatedAt: "2026-09-22T10:01:08Z",
    algorithm: "sha256/canonical-json-v1",
    months: [
      { month: "2026-07", providers: 7, files: 60, bytes: 100, hash: "a".repeat(64) },
      { month: "2026-08", providers: 7, files: 69, bytes: 43990454, hash: "b".repeat(64) },
      { month: "not-a-month", providers: 0, files: 0, bytes: 0, hash: "" },
    ],
  });
  writeJson("2026/08/public/integrity.json", {
    month: "2026-08",
    generatedAt: "2026-09-22T10:01:04Z",
    algorithm: "sha256/canonical-json-v1",
    providers: 1,
    files: 4,
    bytes: 50315,
    hash: "b".repeat(64),
    entries: [{ provider: "etherscan", summary: "4 accounts, 123 transfers", stats: { accounts: 4, transfers: 123 }, files: 4, bytes: 50315, hash: "c".repeat(64) }],
  });
  // The manifest lives in the public tier only; a stewards copy is never read.
  writeJson("2026/07/stewards/integrity.json", { month: "2026-07", hash: "x" });
  process.env.DATA_DIR = tmp;
  jest.isolateModules(() => {
    integrity = require("@/lib/integrity");
  });
});

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("integrity manifests", () => {
  it("lists months newest first and drops malformed entries", () => {
    const index = integrity.readIntegrityIndex()!;
    expect(index.months.map((m) => m.month)).toEqual(["2026-08", "2026-07"]);
  });

  it("exposes the newest month for /status", () => {
    expect(integrity.latestIntegrity()).toMatchObject({ month: "2026-08", hash: "b".repeat(64), algorithm: "sha256/canonical-json-v1" });
  });

  it("reads a month manifest from the public tier only", () => {
    expect(integrity.readMonthIntegrity("2026", "08")?.entries[0].provider).toBe("etherscan");
    expect(integrity.readMonthIntegrity("2026", "07")).toBeNull();
    expect(integrity.readMonthIntegrity("2026", "8")).toBeNull();
  });

  it("formats hashes and sizes for the page", () => {
    expect(integrity.shortHash("b".repeat(64))).toBe("bbbbbbbb…");
    expect(integrity.formatBytes(43990454)).toBe("42.0 MB");
    expect(integrity.formatBytes(50315)).toBe("49 KB");
  });
});
