/**
 * Numbers behind the "cover this expense" panel. Pure, so the slider
 * defaults and the transfer message can be tested without a page.
 */

/** Nobody is asked for less than this; below it the bank fees eat the gift. */
export const MIN_CONTRIBUTION_EUR = 10

/** Upper bound for a single online payment, whatever the expense. */
export const MAX_CONTRIBUTION_EUR = 10_000

/**
 * The slider's ceiling: the whole expense, never below the minimum so the
 * slider still has somewhere to go on a tiny bill.
 */
export function maxContribution(expenseEur: number): number {
  const whole = Math.ceil(Math.max(0, expenseEur))
  return Math.min(MAX_CONTRIBUTION_EUR, Math.max(MIN_CONTRIBUTION_EUR, whole))
}

/** Half the expense, whole euros, never under the minimum. */
export function defaultContribution(expenseEur: number): number {
  const half = Math.round(expenseEur / 2)
  return Math.min(maxContribution(expenseEur), Math.max(MIN_CONTRIBUTION_EUR, half))
}

/** Slider step: fine on small bills, coarser on big ones so it stays usable. */
export function contributionStep(expenseEur: number): number {
  if (expenseEur <= 100) return 1
  if (expenseEur <= 1000) return 5
  return 10
}

/** Clamp anything typed by hand to what the panel accepts. */
export function clampContribution(value: number, expenseEur: number): number {
  if (!Number.isFinite(value)) return defaultContribution(expenseEur)
  return Math.min(maxContribution(expenseEur), Math.max(MIN_CONTRIBUTION_EUR, Math.round(value)))
}

/**
 * The transfer message that ties a bank transfer to one expense. SEPA gives
 * 140 characters; the reference goes first so it survives any truncation.
 */
export function contributionMessage(reference: string, label: string): string {
  const message = `Contribution ${reference} - ${label}`.replace(/\s+/g, " ").trim()
  return message.length > 140 ? `${message.slice(0, 139)}…` : message
}

export function formatEur(n: number): string {
  return new Intl.NumberFormat("en-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n)
}
