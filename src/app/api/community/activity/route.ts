import { NextResponse } from "next/server"
import { fetchTokenTransfers, parseTokenValue, getMonthKey } from "@/lib/etherscan"
import settings from "@/settings/settings.json"
import fs from "fs"
import path from "path"

interface MonthlyActivity {
  month: string // YYYY-MM format
  uniqueContributors: number
  tokenRecipients: number
  discordContributors: number
  score: number
  contributors: string[] // Array of user IDs active this month
}

interface UserInfo {
  id: string
  username: string
  displayName: string
  avatar: string | null
}

async function fetchDiscordContributorsData(): Promise<{
  monthlyContributors: Map<string, number>
  userMap: Record<string, UserInfo>
}> {
  // Map of month -> contributor count
  const monthlyContributors = new Map<string, number>()
  const userMap: Record<string, UserInfo> = {}

  try {
    let baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.BASE_URL || "http://localhost:3000"

    // Add protocol if not present
    if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
      baseUrl = `https://${baseUrl}`
    }

    // Fetch contributors for user map
    const contributorsRes = await fetch(`${baseUrl}/data/contributors.json`, {
      next: { revalidate: 3600 },
    })

    if (contributorsRes.ok) {
      const contributorsData = await contributorsRes.json()
      // Build user map from contributors
      for (const contributor of contributorsData.contributors || []) {
        userMap[contributor.id] = {
          id: contributor.id,
          username: contributor.username,
          displayName: contributor.displayName,
          avatar: contributor.avatar,
        }
      }
    }

    // Fetch activity grid data
    const activityRes = await fetch(`${baseUrl}/data/activitygrid.json`, {
      next: { revalidate: 3600 },
    })

    if (activityRes.ok) {
      const activityData = await activityRes.json()

      // Process activity grid to get monthly contributors
      for (const yearData of activityData.years || []) {
        const year = yearData.year
        for (const monthData of yearData.months || []) {
          const monthKey = `${year}-${monthData.month}`
          if (monthData.contributorCount > 0) {
            monthlyContributors.set(monthKey, monthData.contributorCount)
          }
        }
      }
    }
  } catch (error) {
    console.error("[v0] Error fetching Discord contributors data:", error)
  }

  return { monthlyContributors, userMap }
}

async function fetchTokenRecipientsData(): Promise<Map<string, Set<string>>> {
  // Map of month -> Set of unique recipient addresses
  const monthlyRecipients = new Map<string, Set<string>>()

  try {
    const token = settings.contributionToken

    // Read CHT token transactions from cached monthly files
    const DATA_DIR = path.join(process.cwd(), "data")
    const years = fs.readdirSync(DATA_DIR).filter((name) => /^\d{4}$/.test(name))

    for (const year of years) {
      const yearPath = path.join(DATA_DIR, year)
      const months = fs.readdirSync(yearPath).filter((name) => /^\d{2}$/.test(name))

      for (const month of months) {
        const tokenFilePath = path.join(
          yearPath,
          month,
          "celo",
          "CHT",
          `${token.address.toLowerCase()}.json`
        )

        if (!fs.existsSync(tokenFilePath)) continue

        const tokenData = JSON.parse(fs.readFileSync(tokenFilePath, "utf-8"))
        const transactions = tokenData.transactions || []

        const monthKey = `${year}-${month}`

        for (const tx of transactions) {
          const to = tx.to?.toLowerCase()

          // Count all unique recipients (excluding zero address)
          if (to && to !== "0x0000000000000000000000000000000000000000") {
            if (!monthlyRecipients.has(monthKey)) {
              monthlyRecipients.set(monthKey, new Set())
            }
            monthlyRecipients.get(monthKey)!.add(to)
          }
        }
      }
    }
  } catch (error) {
    console.error("[v0] Error fetching token recipients data:", error)
  }

  return monthlyRecipients
}

export async function GET() {
  try {
    const [{ monthlyContributors: discordContributors, userMap }, tokenRecipients] = await Promise.all([
      fetchDiscordContributorsData(),
      fetchTokenRecipientsData(),
    ])

    // Combine all months
    const allMonths = new Set([...discordContributors.keys(), ...tokenRecipients.keys()])

    const monthlyActivity: MonthlyActivity[] = []
    let firstActivityDate: string | null = null

    for (const month of allMonths) {
      const discordCount = discordContributors.get(month) || 0
      const tokenCount = tokenRecipients.get(month)?.size || 0

      // Use Discord count as unique contributors since token recipients overlap
      const totalUnique = discordCount

      // Calculate score: use Discord contributors as the primary metric
      const score = discordCount

      monthlyActivity.push({
        month,
        uniqueContributors: totalUnique,
        discordContributors: discordCount,
        tokenRecipients: tokenCount,
        score,
        contributors: [], // Empty array - contributors are filtered on the client side
      })

      // Track earliest activity date
      if (!firstActivityDate || month < firstActivityDate) {
        firstActivityDate = month + "-01"
      }
    }

    // Sort by month
    monthlyActivity.sort((a, b) => a.month.localeCompare(b.month))

    return NextResponse.json({
      monthlyActivity,
      firstActivityDate,
      userMap,
    })
  } catch (error) {
    console.error("[v0] Error calculating community activity:", error)
    return NextResponse.json({ error: "Failed to fetch community activity" }, { status: 500 })
  }
}
