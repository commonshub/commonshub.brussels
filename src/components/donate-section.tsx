import Image from "next/image"
import { CreditCard, ExternalLink, Sparkles } from "lucide-react"

import { BankTransferDetails } from "@/components/bank-transfer-details"
import { Button } from "@/components/ui/button"

const ARTIZEN_DONATION_URL =
  "https://artizen.fund/index/p/commons-hub-brussels-1?season=7"
const STRIPE_DONATION_URL = "https://buy.stripe.com/7sIdSnbxz7AE1bi28m"

export function DonateSection() {
  return (
    <main className="min-h-screen">
      <section className="pt-32 pb-16 bg-primary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground">
              Support Commons Hub Brussels
            </h1>
            <p className="mt-6 text-xl text-muted-foreground">
              Help us keep the Commons Hub open. Contribute to our costs.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
          <div className="relative bg-card p-8 rounded-lg border-2 border-primary flex flex-col items-center text-center">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full">
              Preferred
            </span>
            <h2 className="text-2xl font-bold text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Donate via Artizen Fund
            </h2>
            <p className="text-muted-foreground mb-2 max-w-xl">
              Our preferred way to receive donations. Support Commons Hub
              Brussels through our project page on Artizen Fund.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Minimum donation €10. An email address is required.
            </p>

            <div className="hidden md:flex flex-col items-center gap-4">
              <Image
                src="/images/artizen-qrcode.png"
                alt="QR code linking to the Commons Hub Brussels page on Artizen Fund"
                width={240}
                height={240}
                className="rounded-md"
              />
              <Button asChild size="lg" className="mt-auto">
                <a
                  href={ARTIZEN_DONATION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                   <ExternalLink className="w-5 h-5" />
                  Donate online with matched funding
                </a>
              </Button>
            </div>

            <Button asChild size="lg" className="md:hidden mt-auto">
              <a
                href={ARTIZEN_DONATION_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-5 h-5" />
                Donate on Artizen
              </a>
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card p-8 rounded-lg border border-border flex flex-col items-center text-center">
              <h2 className="text-2xl font-bold text-foreground mb-3">
                Card or Bancontact
              </h2>
              <p className="text-muted-foreground mb-6">
                Donate online via Stripe with a credit card or Bancontact.
              </p>
              <Button asChild size="lg" className="mt-auto"
                      variant="outline">
                <a
                  href={STRIPE_DONATION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <CreditCard className="w-5 h-5" />
                  Donate online
                </a>
              </Button>
            </div>

            <div className="bg-card p-8 rounded-lg border border-border flex flex-col items-center text-center">
              <h2 className="text-2xl font-bold text-foreground mb-3">
                Bank transfer
              </h2>
              <p className="text-muted-foreground mb-6">
                <span className="hidden md:inline">
                  Scan the QR code with your banking app to donate via SEPA
                  transfer.
                </span>
                <span className="md:hidden">
                  Copy the details below into your banking app, or save the QR
                  code image and import it from your banking app&apos;s scanner.
                </span>
              </p>
              {/*
                EPC069-12 SEPA transfer QR, generated from src/lib/bank-details.ts
                with: bun run generate:donate-qrcode
              */}
              <Image
                src="/images/donate-qrcode.png"
                alt="QR code for donating via bank transfer"
                width={240}
                height={240}
                className="rounded-md mb-6"
              />
              <BankTransferDetails />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
