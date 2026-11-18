import { MyBookingsList, type MyBooking } from "@/components/dashboard/my-bookings-list"
import { type BotIdentity, callTokenBot } from "@/lib/token-bot"

/**
 * The member's bookings paid in euros (from the bot): upcoming (today's coworking pass, rooms not
 * over yet) and past (the last year), each with its invoice PDF and whether it's paid; pay what's
 * due by card or transfer, cancel a room by the terms. `paid`: the invoice number Stripe Checkout
 * just came back with. Nothing at all when there was never a booking.
 */
export async function MyBookings({ who, paid, readOnly }: { who: BotIdentity; paid?: string; readOnly?: boolean }) {
  const [up, past] = await Promise.all([callTokenBot("mine", who).catch(() => null), callTokenBot("mine", who, { past: true }).catch(() => null)])
  const list = (a: typeof up) => (a?.body.ok ? ((a.body as { bookings?: MyBooking[] }).bookings ?? []) : [])
  const upcoming = list(up)
  const before = list(past)
  if (!upcoming.length && !before.length && !paid) return null
  const policy = (up?.body.ok && (up.body as { policy?: string }).policy) || ""
  return <MyBookingsList upcoming={upcoming} past={before} policy={policy} paid={paid} readOnly={readOnly} />
}
