import type { Metadata } from "next"
import QRCode from "qrcode"

import { BankTransferDetails } from "@/components/bank-transfer-details"
import { epcQrPayload } from "@/lib/bank-details"
import { parsePayRequest } from "@/lib/pay-link"

export const metadata: Metadata = {
  title: "Pay by bank transfer | Commons Hub Brussels",
  robots: { index: false },
}

/**
 * /pay?amount=100.50&communication=…: a bank transfer to the Commons Hub,
 * filled in from the link we send with an invoice (lib/pay-link.ts). Every
 * detail with a copy button, and a QR code for a banking app. Without an
 * amount, the payer fills it in.
 */
export default async function PayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { amount, structured, message } = parsePayRequest(await searchParams)
  const qr = await QRCode.toString(epcQrPayload(amount ?? undefined, message, structured ?? undefined), { type: "svg", errorCorrectionLevel: "M", margin: 0 })
  const communication = structured ?? message

  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-12">
      <h1 className="text-3xl font-extrabold text-foreground">Pay by bank transfer</h1>
      <p className="mt-2 text-muted-foreground">
        {amount ? (
          <>
            <span className="font-semibold text-foreground">€{amount.toFixed(2)}</span> to the Commons Hub Brussels.{" "}
          </>
        ) : (
          "A transfer to the Commons Hub Brussels. "
        )}
        Scan the code with your banking app, or copy each detail.
      </p>

      <div className="mt-6 flex flex-col items-center gap-6 rounded-2xl border border-border bg-card p-6">
        <div className="w-48 rounded-xl bg-white p-3" role="img" aria-label="QR code for your banking app, with every detail filled in" dangerouslySetInnerHTML={{ __html: qr }} />
        <BankTransferDetails amountEur={amount ?? undefined} message={message} structured={structured ?? undefined} />
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {communication ? "Please keep the communication exactly as it is: it's how we match your transfer to your invoice. " : ""}
        Transfers take one or two working days. Questions?{" "}
        <a href="mailto:hello@commonshub.brussels" className="text-primary underline">
          hello@commonshub.brussels
        </a>
      </p>
    </div>
  )
}
