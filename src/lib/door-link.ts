/**
 * A personal link that opens the hub's door during a time window, signed
 * the way the door server (door.commonshub.brussels) and the Discord bot
 * expect (same message format as opencollective/token-bot's door-link.ts).
 * Needs DOOR_SIGNING_KEY on the server; without it, no link.
 */

import { Wallet } from "ethers"

export const DOOR_URL = "https://door.commonshub.brussels"

const clean = (s: string) => s.replace(/[&=\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100)

export async function buildDoorLink(p: { name: string; host: string; reason: string; start: Date; end: Date }, privateKey = process.env.DOOR_SIGNING_KEY, now = new Date()): Promise<string | null> {
  if (!privateKey) return null
  const fields = {
    name: clean(p.name),
    host: clean(p.host),
    reason: clean(p.reason),
    timestamp: Math.floor(now.getTime() / 1000),
    startTime: Math.floor(p.start.getTime() / 1000),
    duration: Math.max(1, Math.round((p.end.getTime() - p.start.getTime()) / 60000)),
  }
  const message = `name=${fields.name}&host=${fields.host}&reason=${fields.reason}&timestamp=${fields.timestamp}&startTime=${fields.startTime}&duration=${fields.duration}&booking=1`
  const sig = await new Wallet(privateKey).signMessage(message)
  const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)])), booking: "1", sig })
  return `${DOOR_URL}/open?${q}`
}
