import { NextResponse } from "next/server"

import { callBotLogin } from "@/lib/token-bot"

export const dynamic = "force-dynamic"

// A few requests per address per minute from one visitor; the bot has its own limits per email.
const recent = new Map<string, number[]>()
const LIMIT = 5

/**
 * POST /api/auth/email-code { email }: ask the bot to email a sign-in code.
 * The bot sends one only when the address belongs to a partner in Odoo, and
 * answers the same either way; the code is then given to Auth.js's
 * "email-code" sign-in (src/auth.ts).
 */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const now = Date.now()
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 60_000)
  if (hits.length >= LIMIT) return NextResponse.json({ ok: false, error: "Too many requests: wait a minute." }, { status: 429 })
  recent.set(ip, [...hits, now])
  if (recent.size > 10_000) recent.clear()

  const body = (await request.json().catch(() => ({}))) as { email?: unknown }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : ""
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ ok: false, error: "That email address doesn't look valid." }, { status: 400 })
  const answer = await callBotLogin("code", { email })
  return NextResponse.json(answer.body, { status: answer.status })
}
