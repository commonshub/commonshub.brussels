/**
 * @jest-environment node
 */
import { describe, expect, test } from "@jest/globals";
import { GET } from "@/app/today/route";

describe("/today", () => {
  test("redirects to today's day page in Brussels time", async () => {
    const res = GET(new Request("https://commonshub.brussels/today"));
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toMatch(/^https:\/\/commonshub\.brussels\/\d{4}\/\d{2}\/\d{2}$/);
    const expected = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    expect(location.endsWith("/" + expected.replaceAll("-", "/"))).toBe(true);
  });
});
