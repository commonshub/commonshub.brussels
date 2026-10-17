/**
 * What paying with tokens gets you, said wherever we say you can pay with
 * them: not the same service as paying in euros. With euros you buy a
 * service (a desk, a room, cleaning and stewarding included, invoiced with
 * VAT); with tokens a contributor uses capacity that is idle, with no
 * guarantee and nothing extra. Keep the wording here, in one place.
 *
 * coworking: a desk for the day (/buy on Discord). rooms: booking any room
 * by the hour, the coworking room in the evening included.
 */
export const TOKEN_TERMS = {
  coworking:
    "Contributor coworking (with tokens): use an available desk when capacity is idle; no guaranteed desk, no advance reservation, subject to community activities.",
  rooms:
    "Rooms booked with tokens: only when capacity is idle, subject to community activities, without cleaning or stewarding.",
} as const

export type TokenTermsKind = keyof typeof TOKEN_TERMS
