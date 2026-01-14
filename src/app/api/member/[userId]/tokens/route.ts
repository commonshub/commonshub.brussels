import { NextResponse } from "next/server"
import { getAccountAddressFromDiscordUserId } from "@/lib/citizenwallet"
import {
  fetchTokenBalance,
  fetchTokenTransfers,
  parseTokenBalance,
  parseTokenValue,
  getMonthKey,
} from "@/lib/etherscan"
import settings from "@/settings/settings.json"

interface MonthlyActivity {
  month: string // YYYY-MM format
  received: number // total CHT received
  count: number // number of transactions
  score: number // weighted score based on transaction amounts + discord activity
  discordDays: number // number of days with Discord activity
}

async function fetchDiscordContributions(userId: string): Promise<Map<string, Set<string>>> {
  // Map of month -> Set of active days (YYYY-MM-DD)
  const monthlyActiveDays = new Map<string, Set<string>>()

  try {
    let baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.BASE_URL || "http://localhost:3000"

    // Add protocol if not present
    if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
      baseUrl = `https://${baseUrl}`
    }

    // First, get the contributor's username from contributors.json
    const contributorsRes = await fetch(`${baseUrl}/data/contributors.json`, {
      next: { revalidate: 3600 },
    })

    if (!contributorsRes.ok) return monthlyActiveDays

    const contributorsData = await contributorsRes.json()
    const contributor = contributorsData.contributors?.find((c: any) => c.id === userId)

    if (!contributor) return monthlyActiveDays

    // Fetch the user's profile data
    const profileRes = await fetch(`${baseUrl}/data/generated/profiles/${contributor.username}.json`, {
      next: { revalidate: 3600 },
    })

    if (!profileRes.ok) return monthlyActiveDays

    const profile = await profileRes.json()
    const contributions = profile.contributions || []

    for (const contribution of contributions) {
      const date = new Date(contribution.timestamp)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      const dayKey = date.toISOString().split("T")[0]

      if (!monthlyActiveDays.has(monthKey)) {
        monthlyActiveDays.set(monthKey, new Set())
      }
      monthlyActiveDays.get(monthKey)!.add(dayKey)
    }
  } catch (error) {
    console.error("[v0] Error fetching Discord contributions:", error)
  }

  return monthlyActiveDays
}

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params

  try {
    const [walletAddress, discordActiveDays] = await Promise.all([
      getAccountAddressFromDiscordUserId(userId),
      fetchDiscordContributions(userId),
    ])

    console.log(`[v0] tokens API: userId=${userId} walletAddress=${walletAddress}`)

    if (!walletAddress || walletAddress === "0x0000000000000000000000000000000000000000") {
      const monthlyActivity: MonthlyActivity[] = []
      let firstActivityDate: string | null = null

      for (const [month, days] of discordActiveDays) {
        const discordDays = days.size
        monthlyActivity.push({
          month,
          received: 0,
          count: 0,
          score: discordDays, // +1 per active day
          discordDays,
        })

        // Track earliest date
        for (const day of days) {
          if (!firstActivityDate || day < firstActivityDate) {
            firstActivityDate = day
          }
        }
      }

      monthlyActivity.sort((a, b) => a.month.localeCompare(b.month))

      return NextResponse.json({
        walletAddress: null,
        balance: 0,
        monthlyActivity,
        totalReceived: 0,
        firstActivityDate,
      })
    }

    const token = settings.contributionToken
    const apiKey = process.env.ETHERSCAN_API_KEY || ""

    // Fetch token balance and transfers
    const [balanceData, transfersData] = await Promise.all([
      fetchTokenBalance(token.chainId, token.address, walletAddress, apiKey),
      fetchTokenTransfers(token.chainId, token.address, walletAddress, apiKey),
    ])

    const balance = balanceData.status === "1" ? parseTokenBalance(balanceData.result, token.decimals) : 0
    const transfers = Array.isArray(transfersData.result) ? transfersData.result : []
    console.log(`[v0] tokens API: balance=${balance} transfers count=${transfers.length}`)

    // Filter incoming transfers and calculate monthly activity
    const incomingTransfers = transfers.filter((tx) => tx.to.toLowerCase() === walletAddress.toLowerCase())

    const monthlyMap = new Map<string, { received: number; count: number; score: number; discordDays: number }>()
    let totalReceived = 0
    let firstTxDate: string | null = null

    for (const tx of incomingTransfers) {
      const monthKey = getMonthKey(Number(tx.timeStamp))
      const amount = parseTokenValue(tx.value, token.decimals)
      const txDate = new Date(Number(tx.timeStamp) * 1000).toISOString().split("T")[0]

      // Track earliest transaction date
      if (!firstTxDate || txDate < firstTxDate) {
        firstTxDate = txDate
      }

      totalReceived += amount

      let txScore = 0
      if (amount <= 3) {
        txScore = 1
      } else if (amount <= 6) {
        txScore = 2
      } else if (amount <= 10) {
        txScore = 3
      }

      const existing = monthlyMap.get(monthKey) || { received: 0, count: 0, score: 0, discordDays: 0 }
      monthlyMap.set(monthKey, {
        received: existing.received + amount,
        count: existing.count + 1,
        score: existing.score + txScore,
        discordDays: existing.discordDays,
      })
    }

    let firstDiscordDate: string | null = null
    for (const [month, days] of discordActiveDays) {
      const discordDays = days.size
      const existing = monthlyMap.get(month) || { received: 0, count: 0, score: 0, discordDays: 0 }
      monthlyMap.set(month, {
        ...existing,
        score: existing.score + discordDays,
        discordDays,
      })

      // Track earliest Discord date
      for (const day of days) {
        if (!firstDiscordDate || day < firstDiscordDate) {
          firstDiscordDate = day
        }
      }
    }

    let firstActivityDate: string | null = null
    if (firstTxDate && firstDiscordDate) {
      firstActivityDate = firstTxDate < firstDiscordDate ? firstTxDate : firstDiscordDate
    } else {
      firstActivityDate = firstTxDate || firstDiscordDate
    }

    // Convert to sorted array
    const monthlyActivity: MonthlyActivity[] = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month))

    return NextResponse.json({
      walletAddress,
      balance,
      monthlyActivity,
      totalReceived,
      symbol: token.symbol,
      firstActivityDate,
    })
  } catch (error) {
    console.error("[v0] Error fetching token data:", error)
    return NextResponse.json({ error: "Failed to fetch token data" }, { status: 500 })
  }
}
