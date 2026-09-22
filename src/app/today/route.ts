import { NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";

/** /today → /YYYY/MM/DD for today in Brussels, whatever the server clock's zone. */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const now = toZonedTime(new Date(), "Europe/Brussels");
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return NextResponse.redirect(new URL(`/${year}/${month}/${day}`, request.url), 302);
}
