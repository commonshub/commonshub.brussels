import type { Shift } from "./shifts-service"

/** A member's first shift that isn't over yet. */
export function nextShiftOf(shifts: Shift[], user: { discordId: string; username: string }, now: number): Shift | null {
  return (
    shifts
      .filter((s) => Date.parse(s.end) > now && s.signups.some((p) => isUser(p, user)))
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0] ?? null
  )
}

/** A sign-up is the member by Discord id, or by username for an old line without one. */
export const isUser = (p: { discordUserId: string; username: string }, user: { discordId: string; username: string }) => (p.discordUserId ? p.discordUserId === user.discordId : p.username === user.username)
