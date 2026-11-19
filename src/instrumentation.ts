/**
 * Runs once when the server starts. Vouches given on Discord (a ✅ reaction on
 * an application's post in #membership) are synced every two minutes, so an
 * application is approved without anyone opening /members/pending. Accepted applicants who
 * haven't paid a week later get one reminder.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production" || !process.env.DISCORD_BOT_TOKEN) return
  const { remindUnpaid, syncReactionVouches } = await import("./lib/membership-applications-store")
  let running = false
  setInterval(() => {
    if (running) return
    running = true
    syncReactionVouches()
      .catch((error) => console.error("[membership] reaction sync failed:", error))
      .finally(() => (running = false))
  }, 2 * 60_000)
  // Accepted a week ago and not paid: one personal reminder (checked hourly, sent in the daytime).
  if (PAYMENT_REMINDERS)
    setInterval(() => {
      remindUnpaid().catch((error) => console.error("[membership] payment reminders failed:", error))
    }, 60 * 60_000)
}

/** Off until the list of who'd get it has been checked. */
const PAYMENT_REMINDERS = false
