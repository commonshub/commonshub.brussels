import { describe, expect, it } from "@jest/globals";
import { opendataCoverage, type OpendataMonth } from "@/lib/opendata-monthly";

const row = (month: string, opens: number | null, status: OpendataMonth["status"] = "closed"): OpendataMonth => ({
  month,
  status,
  href: "",
  money: null,
  activity: null,
  expenses: null,
  invoicedIncome: null,
  bookings: null,
  door: opens === null ? null : { openers: 1, openDays: 1, tokenOpens: 0, totalOpens: opens },
  members: null,
  tokens: null,
  notes: [],
});

describe("opendataCoverage", () => {
  it("finds the first month, the unbroken run up to now, and the gaps", () => {
    const coverage = opendataCoverage([
      row("2026-01", null),
      row("2026-02", 3),
      row("2026-03", 0),
      row("2026-04", 5),
      row("2026-05", 2, "current"),
      row("2026-06", 0, "future"),
    ]);
    expect(coverage.door).toEqual({ first: "2026-02", everyMonthSince: "2026-04", emptyMonths: 1 });
    expect(coverage.members).toEqual({ first: null, everyMonthSince: null, emptyMonths: 0 });
  });

  it("has no unbroken run when the latest month is empty", () => {
    expect(opendataCoverage([row("2026-01", 3), row("2026-02", 0)]).door).toEqual({
      first: "2026-01",
      everyMonthSince: null,
      emptyMonths: 1,
    });
  });
});
