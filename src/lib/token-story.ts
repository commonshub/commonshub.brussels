/**
 * What /token and /token/slides tell: how members earn tokens by caring for
 * the hub, and what they spend them on. One source for both pages.
 *
 * The amounts are the bot's (opencollective/token-bot): weekly role
 * issuance from its roles.json, 1 token an hour of shift
 * (settings.shifts.rewardAmountPerHour), 1 token for attending the
 * heartbeat or a park cleaning, coworking and guest passes from its shop,
 * room prices from its products.json. People read "tokens", never the symbol.
 */

export interface EarnWay {
  id: string
  title: string
  amount: string
  text: string
  /** A photo, or a drawn example (`visual`) for ways nobody has photographed. */
  photo?: string
  photoAlt?: string
  visual?: "market"
  caption?: string
  /** Extra photos, shown smaller. */
  more?: Array<{ src: string; alt: string }>
}

export const EARN: EarnWay[] = [
  {
    id: "heartbeat",
    title: "Come to the Heartbeat",
    amount: "1 token",
    text: "Every Monday from 13:00 to 14:00, members meet around the big table: what happened this week, who did what, what we decide together. Everyone who comes gets a token, and the contributions shared during the week are rewarded there too.",
    photo: "/images/token/heartbeat.jpg",
    photoAlt: "Members around the table at a Heartbeat meeting, one of them holding up a laptop showing the website",
  },
  {
    id: "park",
    title: "Clean the park",
    amount: "1 token",
    text: "Grab a bucket and a litter picker, and clean the park and the street around the hub with other members. It's the commons right outside our door.",
    photo: "/images/token/park-cleaning.jpg",
    photoAlt: "Members with buckets and litter pickers, smiling, during a park cleaning",
    more: [
      { src: "/images/token/park-cleaning-2.jpg", alt: "A group of members in the park with their buckets" },
      { src: "/images/token/park-cleaning-bucket.jpg", alt: "A bucket full of litter picked up in the park" },
    ],
  },
  {
    id: "roles",
    title: "Pick up a role",
    amount: "½ to 2 tokens a week",
    text: "Take care of one part of the hub, every week: water the plants, vacuum the carpets, keep the kitchen or the toilets clean, take the trash out, take notes at the Heartbeat. As long as you hold the role, tokens arrive every week.",
    photo: "/images/token/plants.jpg",
    photoAlt: "Members holding the big fig plants they are taking care of",
    more: [
      { src: "/images/token/plant-steward.jpg", alt: "The plant steward with a watering can" },
      { src: "/images/token/trash.jpg", alt: "A member taking the trash out" },
    ],
  },
  {
    id: "shifts",
    title: "Steward a shift",
    amount: "1 token an hour",
    text: "The hub needs someone whenever it's open: welcome people, show them around, look after an event. Sign up on the tablet at the entrance, on commonshub.brussels/shifts or with /shifts on Discord.",
    photo: "/images/token/tablet-shifts.jpg",
    photoAlt: "The shifts tablet: this week's shifts, who signed up, and the bookings that need a steward",
    caption: "The tablet at the entrance: tap a time to sign up.",
  },
  {
    id: "market",
    title: "Offers and needs",
    amount: "agreed between you",
    text: "Members help each other, and pay each other in tokens. Post what you can do in #offers, answer someone's request in #needs: fixing a bike, a translation, a hand to move, a lesson. The one you helped sends you tokens with /send.",
    visual: "market",
    caption: "An example from #needs on Discord.",
  },
]

/** Roles and what they bring each week (the bot's roles.json). */
export const ROLES: Array<{ name: string; tokens: number }> = [
  { name: "Plant steward", tokens: 2 },
  { name: "Carpet steward (vacuuming)", tokens: 2 },
  { name: "Kitchen steward", tokens: 2 },
  { name: "Toilet steward", tokens: 2 },
  { name: "Stairs steward", tokens: 2 },
  { name: "Surfaces steward", tokens: 2 },
  { name: "Communication steward", tokens: 2 },
  { name: "Note taker", tokens: 1 },
  { name: "Trash steward", tokens: 1 },
  { name: "Dishwasher and sink steward", tokens: 1 },
  { name: "Groceries steward", tokens: 1 },
  { name: "Laundry steward", tokens: 1 },
  { name: "Tech steward", tokens: 1 },
]

/** Rooms members can book with tokens, per hour (the bot's products.json). */
export const ROOM_TOKENS: Array<{ name: string; perHour: number; note?: string }> = [
  { name: "Phone booth", perHour: 0.5 },
  { name: "Mush Room", perHour: 1 },
  { name: "Angel Room", perHour: 1 },
  { name: "Satoshi Room", perHour: 2 },
  { name: "Ostrom Room", perHour: 3 },
  { name: "Coworking space", perHour: 2, note: "from 7pm" },
]

export const tokens = (n: number) => `${n === 0.5 ? "½" : n} token${n === 1 || n === 0.5 ? "" : "s"}`

/** The guest pass, as a member does it on their phone. */
export const GUEST_PASS_SCREENS: Array<{ src: string; alt: string; caption: string }> = [
  { src: "/images/token/phone-dashboard.jpg", alt: "The member dashboard on a phone: open the door, ask Elinor, cowork, book a room", caption: "Log in: your dashboard" },
  { src: "/images/token/phone-guest-form.jpg", alt: "The guest pass form: half day or full day, date, start time, guest's name and optional email, 1 token", caption: "Cowork → For a guest" },
  { src: "/images/token/phone-guest-done.jpg", alt: "Confirmation: your guest Leo is welcome at the hub, with a link and a QR code to share", caption: "Paid: share the link or QR code" },
  { src: "/images/token/phone-pass.jpg", alt: "Leo's coworking pass with an Open the door button", caption: "Your friend opens the door" },
]
