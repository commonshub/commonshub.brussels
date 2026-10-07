import { publicName } from "./fridge"

/**
 * After a fridge donation by card, the thank-you page asks how the donor
 * wants to be thanked in public: not at all, by the first name or the full
 * name they paid with (shown as such, so they see what will appear), or a
 * name of their own ("Other"). The answer is kept on the payment in Stripe
 * (metadata `thanks` and `name`), where the donor lists already read it.
 */
export type Attribution = "anonymous" | "first" | "full" | "other"

const clean = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ")

/** The choices, with the names they would show. */
export function attributionOptions(paidName: string | null | undefined): Array<{ value: Attribution; label: string }> {
  const full = clean(paidName)
  const first = full.split(" ")[0]
  return [
    { value: "anonymous", label: "Don't show my name" },
    ...(first ? [{ value: "first" as const, label: first }] : []),
    ...(full && full !== first ? [{ value: "full" as const, label: full }] : []),
    { value: "other", label: "Other…" },
  ]
}

/** The name to show for a choice: null for none; undefined when the choice is not acceptable. */
export function attributionName(choice: unknown, paidName: string | null | undefined, other?: unknown): string | null | undefined {
  const full = clean(paidName)
  if (choice === "anonymous") return null
  if (choice === "first") return full ? full.split(" ")[0] : undefined
  if (choice === "full") return full || undefined
  if (choice === "other") return publicName(other) ?? undefined
  return undefined
}

export const isEmail = (s: unknown): s is string => typeof s === "string" && s.length <= 200 && /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(s.trim())
