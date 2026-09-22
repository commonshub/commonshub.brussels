import { NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";

/** /today → /YYYY/MM/DD for today in Brussels, whatever the server clock's zone. */
export const dynamic = "force-dynamic";

export function GET() {
  const now = toZonedTime(new Date(), "Europe/Brussels");
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  // A relative Location: behind the reverse proxy the request URL is the
  // container's own address, which must not end up in the browser.
  return new NextResponse(null, { status: 302, headers: { Location: `/${year}/${month}/${day}` } });
}
