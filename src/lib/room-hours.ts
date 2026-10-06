/**
 * Some rooms can only be booked from a given time of day (rooms.json
 * "bookableFrom", e.g. the coworking space after 7pm, once coworkers have
 * left). Same rule as the Discord bot's /book.
 */
export function bookableFromHour(bookableFrom?: string | null): number {
  return bookableFrom ? parseInt(bookableFrom.split(":")[0], 10) || 0 : 0
}

/** "19:00" → "from 7pm". */
export function bookableFromLabel(bookableFrom?: string | null): string {
  const h = bookableFromHour(bookableFrom)
  if (!h) return ""
  return `from ${h % 12 || 12}${h < 12 ? "am" : "pm"}`
}
