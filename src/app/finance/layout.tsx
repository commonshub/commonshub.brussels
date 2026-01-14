import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Transparent Finances | Commons Hub Brussels",
  description: "All community funds are managed transparently. View our accounts, balances, and transaction history.",
  openGraph: {
    title: "Transparent Finances | Commons Hub Brussels",
    description: "All community funds are managed transparently. View our accounts, balances, and transaction history.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Transparent Finances | Commons Hub Brussels",
    description: "All community funds are managed transparently. View our accounts, balances, and transaction history.",
  },
}

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
