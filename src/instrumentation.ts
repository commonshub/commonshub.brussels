/**
 * Runs once when the server starts. Vouches given on Discord (a ✅ reaction on
 * an application's post in #membership) are synced every two minutes, so an
 * application is approved without anyone opening /members/pending.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production" || !process.env.DISCORD_BOT_TOKEN) return
  const { syncReactionVouches } = await import("./lib/membership-applications-store")
  let running = false
  setInterval(() => {
    if (running) return
    running = true
    syncReactionVouches()
      .catch((error) => console.error("[membership] reaction sync failed:", error))
      .finally(() => (running = false))
  }, 2 * 60_000)
}
