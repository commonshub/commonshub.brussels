/** Flags for the countries our counterparties are in, found by name in an annotation note. */

const COUNTRIES: Array<[RegExp, string]> = [
  [/\bUnited States\b|\bUSA?\b/, "US"],
  [/\bNetherlands\b/, "NL"],
  [/\bSwitzerland\b/, "CH"],
  [/\bGibraltar\b/, "GI"],
  [/\bGermany\b/, "DE"],
  [/\bBelgi(um|an)\b/, "BE"],
  [/\bFrance\b/, "FR"],
  [/\bUnited Kingdom\b/, "GB"],
  [/\bSri Lanka\b/, "LK"],
  [/\bCura[çc]ao\b/, "CW"],
  [/\bItaly\b/, "IT"],
  [/\bSpain\b/, "ES"],
  [/\bPortugal\b/, "PT"],
  [/\bLuxembourg\b/, "LU"],
  [/\bAustria\b/, "AT"],
  [/\bCanada\b/, "CA"],
]

const flag = (iso: string) => String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))

/** The flag of the first country a note names, or "". */
export function countryFlag(text: string | null | undefined): string {
  if (!text) return ""
  for (const [re, iso] of COUNTRIES) if (re.test(text)) return flag(iso)
  return ""
}
