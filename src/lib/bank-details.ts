// Bank account used for SEPA donations. After changing anything here,
// regenerate the QR code: bun run generate:donate-qrcode

export const BANK_DETAILS = {
  beneficiary: "Commons Hub Brussels ASBL",
  iban: "EE727777000138317915",
  bic: "LHVBEE22",
  message: "Donation for the Commons Hub Brussels",
}

export function formatIban(iban: string): string {
  return iban.replace(/(.{4})(?=.)/g, "$1 ")
}

/**
 * EPC069-12 "SEPA credit transfer" QR payload (version 002, UTF-8).
 * Amount is left empty so the donor chooses it in their banking app; the
 * message defaults to the general donation one but a page for a specific
 * expense passes its own so the transfer can be matched to it.
 */
export function epcQrPayload(amountEur?: number, message: string = BANK_DETAILS.message): string {
  return [
    "BCD",
    "002",
    "1",
    "SCT",
    BANK_DETAILS.bic,
    BANK_DETAILS.beneficiary,
    BANK_DETAILS.iban,
    amountEur ? `EUR${amountEur.toFixed(2)}` : "",
    "CHAR",
    "",
    // The unstructured remittance field is capped at 140 characters.
    message.slice(0, 140),
  ].join("\n")
}
