import { NextResponse } from "next/server"
import { processStripeAccount, processEtherscanAccount } from "@/lib/transaction-cache"
import settings from "@/settings/settings.json"

/**
 * Warm up transaction cache by fetching latest transactions
 * This endpoint is designed to be called by Vercel Cron Jobs
 */
export async function GET() {
  const results: Record<string, { success: boolean; error?: string; balance?: number }> = {}

  try {
    // Process all accounts from settings
    const accounts = settings.finance.accounts

    for (const account of accounts) {
      try {
        if (account.provider === "stripe") {
          const stripeKey = process.env.STRIPE_SECRET_KEY
          if (!stripeKey) {
            results[account.slug] = {
              success: false,
              error: "STRIPE_SECRET_KEY not configured",
            }
            continue
          }

          console.log(`[Warmup] Processing Stripe account: ${account.slug}`)
          const result = await processStripeAccount(
            {
              slug: account.slug,
              name: account.name,
              currency: account.currency,
            },
            stripeKey
          )

          results[account.slug] = {
            success: true,
            balance: result.balance,
          }
        } else if (account.provider === "etherscan") {
          const etherscanKey = process.env.ETHERSCAN_API_KEY
          if (!etherscanKey) {
            results[account.slug] = {
              success: false,
              error: "ETHERSCAN_API_KEY not configured",
            }
            continue
          }

          console.log(`[Warmup] Processing Etherscan account: ${account.slug}`)
          const result = await processEtherscanAccount(
            {
              slug: account.slug,
              name: account.name,
              chain: account.chain,
              chainId: account.chainId,
              address: account.address,
              token: account.token,
            },
            etherscanKey
          )

          results[account.slug] = {
            success: true,
            balance: result.balance,
          }
        }
      } catch (error) {
        console.error(`Error processing account ${account.slug}:`, error)
        results[account.slug] = {
          success: false,
          error: String(error),
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in transaction warmup:", error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * POST: Same as GET for cron job compatibility
 */
export async function POST() {
  return GET()
}
