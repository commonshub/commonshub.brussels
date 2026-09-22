/**
 * @jest-environment node
 */
import { describe, expect, test } from "@jest/globals";
import { GET } from "@/app/today/route";

describe("/today", () => {
  test("redirects to today's day page in Brussels time, with a relative Location", () => {
    const res = GET();
    expect(res.status).toBe(302);
    const expected = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    expect(res.headers.get("location")).toBe("/" + expected.replaceAll("-", "/"));
  });
});
