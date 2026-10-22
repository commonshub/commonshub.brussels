/**
 * Guest passes: a member buys a door link for a guest with their tokens on
 * Discord (opencollective/token-bot, /guestpass). The member shares
 * commonshub.brussels/pass#<signed door-link parameters>&pass=half-day|day;
 * the page shows the pass and opens the real signed link.
 *
 * Everything sits in the URL fragment, which browsers never send to the
 * server: the website never receives, stores or logs the guest's name. The
 * door server checks the signature when the guest opens the door.
 */

export const DOOR_OPEN_URL = "https://door.commonshub.brussels/open"

/** The door accepts a signed link from 30 minutes before its start until 30 minutes after its end (token-bot signs the pass 30 minutes shorter at each end). */
export const DOOR_GRACE_MINUTES = 30

/** Desk coworking prices, as on /coworking (+ VAT). There is no half-day price in euros. */
export const COWORKING_EUR = { day: 25, month: 100 }

export const GUEST_PASS_TOKENS = { "half-day": 1, day: 2 } as const
export type PassLength = keyof typeof GUEST_PASS_TOKENS

/** "Half day: 1 token (a coworking day is €25 + VAT)", "Full day: €25 (+VAT) or 2 tokens". */
export function passCost(length: PassLength): string {
  return length === "day"
    ? `Full day: €${COWORKING_EUR.day} (+VAT) or ${GUEST_PASS_TOKENS.day} tokens`
    : `Half day: ${GUEST_PASS_TOKENS["half-day"]} token (a coworking day is €${COWORKING_EUR.day} + VAT)`
}

/** The legal fine print under a pass (same as the guest email). */
export const PASS_DISCLAIMER =
  "Spaces paid with tokens are only offered when there is spare, unsold capacity, a bit like Too Good To Go: there's no guaranteed desk or room, and it is not a commercial rental. " +
  "Membership fees support the association and are not payment for a service; anything bought with money (coworking, renting a room, an event ticket) is invoiced separately, with VAT."

const SIGNED = ["name", "host", "reason", "timestamp", "startTime", "duration", "eventUrl", "booking", "sig"] as const

export interface Pass {
  guest: string
  host: string
  length: PassLength
  /** When the door opens for the guest, and until when. */
  from: Date
  until: Date
  /** The signed door link the button opens. */
  doorUrl: string
}

/** The pass in a /pass#… fragment, or null when something is missing. */
export function parsePass(fragment: string): Pass | null {
  const q = new URLSearchParams(fragment.replace(/^#/, ""))
  const name = q.get("name"), host = q.get("host"), start = Number(q.get("startTime")), duration = Number(q.get("duration"))
  if (!name || !host || !q.get("sig") || !q.get("reason") || !q.get("timestamp") || !Number.isFinite(start) || !(duration > 0)) return null
  const door = new URLSearchParams()
  for (const key of SIGNED) {
    const v = q.get(key)
    if (v !== null) door.set(key, v)
  }
  const grace = DOOR_GRACE_MINUTES * 60000
  return {
    guest: name,
    host,
    length: q.get("pass") === "day" ? "day" : "half-day",
    from: new Date(start * 1000 - grace),
    until: new Date((start + duration * 60) * 1000 + grace),
    doorUrl: `${DOOR_OPEN_URL}?${door.toString()}`,
  }
}

export type PassState = "upcoming" | "active" | "expired"
export function passState(p: Pick<Pass, "from" | "until">, now = new Date()): PassState {
  return now < p.from ? "upcoming" : now > p.until ? "expired" : "active"
}
