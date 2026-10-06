/**
 * Pages for the hub's big screen: a 55-inch TV in landscape, shown at
 * 1920×1080 (sometimes 3840×2160) and read from across the room. They live at
 * /…/screen, fill exactly one screen, and refresh themselves so the TV can
 * stay on all day.
 */

/** /events/ocd-2026/screen, /contribute/screen, and the community tablet (/tablet): no site header or footer. */
export function isScreenRoute(pathname: string | null | undefined): boolean {
  return !!pathname && (/\/screen\/?$/.test(pathname) || /^\/tablet\/?$/.test(pathname))
}

/** "14:05", the hub's local time. */
export function brusselsTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })
}

/** "4 Oct 2026", the hub's local date. */
export function brusselsDay(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Brussels" })
}
