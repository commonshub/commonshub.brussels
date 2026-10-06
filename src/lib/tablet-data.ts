/**
 * What /tablet reads: the next events (the public tier's upcoming events,
 * as /events/screen shows them) and the shifts around them, from the shifts
 * calendar.
 */

import { loadScreenEvents } from "./events-screen"
import { withShifts, type TabletEvent, type TabletEventWithShifts } from "./tablet"
import { isShiftsConfigured, listShifts, REWARD_PER_HOUR } from "./shifts-service"

/** Events of the next two weeks, at most eight, soonest first. */
export async function loadTabletEvents(now = Date.now()): Promise<TabletEvent[]> {
  const horizon = now + 14 * 86_400_000
  return loadScreenEvents(now, 8)
    .filter((e) => e.startMs < horizon)
    .map((e) => ({ id: e.id, name: e.name, startMs: e.startMs, endMs: e.endMs, cover: e.cover }))
}

export interface TabletData {
  events: TabletEventWithShifts[]
  /** False when the shifts calendar cannot be reached: the tablet shows the events and says sign-ups are unavailable. */
  shiftsAvailable: boolean
  rewardAmountPerHour: number
  rewardTokenSymbol: string
}

export async function loadTablet(now = Date.now()): Promise<TabletData> {
  const events = await loadTabletEvents(now)
  if (!isShiftsConfigured() || events.length === 0) {
    return { events: withShifts(events, []), shiftsAvailable: isShiftsConfigured(), rewardAmountPerHour: REWARD_PER_HOUR, rewardTokenSymbol: "tokens" }
  }
  try {
    const last = Math.max(...events.map((e) => e.endMs))
    const shifts = await listShifts(new Date(now - 6 * 3_600_000), new Date(last + 6 * 3_600_000))
    return { events: withShifts(events, shifts), shiftsAvailable: true, rewardAmountPerHour: REWARD_PER_HOUR, rewardTokenSymbol: "tokens" }
  } catch (error) {
    console.error("[tablet] could not load shifts:", error)
    return { events: withShifts(events, []), shiftsAvailable: false, rewardAmountPerHour: REWARD_PER_HOUR, rewardTokenSymbol: "tokens" }
  }
}
