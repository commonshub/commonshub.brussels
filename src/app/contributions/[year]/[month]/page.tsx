import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import settings from "@/settings/settings.json"
import { ContributorCard } from "@/components/contributor-card"
import { DiscordImageGallery } from "@/components/discord-image-gallery"
import * as fs from "fs"
import * as path from "path"

interface PageProps {
  params: Promise<{
    year: string
    month: string
  }>
}

interface MonthlyReportData {
  year: string
  month: string
  activeMembers: {
    count: number
    users: Array<{
      id: string
      username: string
      displayName: string | null
      avatar: string | null
      tokensReceived?: number
      tokensSpent?: number
    }>
  }
  photos: Array<{
    url: string
    author: {
      id: string
      username: string
      displayName: string | null
      avatar: string | null
    }
    reactions: Array<{ emoji: string; count: number }>
    totalReactions: number
    message: string
    timestamp: string
    channelId?: string
    messageId?: string
  }>
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

// Generate static params for all available months
export async function generateStaticParams() {
  try {
    const fs = await import("fs/promises")
    const path = await import("path")

    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data")
    const years = await fs.readdir(dataDir)

    const params: Array<{ year: string; month: string }> = []

    for (const year of years) {
      // Skip if not a year directory (4 digits)
      if (!/^\d{4}$/.test(year)) continue

      const yearPath = path.join(dataDir, year)
      const stat = await fs.stat(yearPath)
      if (!stat.isDirectory()) continue

      const months = await fs.readdir(yearPath)

      for (const month of months) {
        // Skip if not a month directory (2 digits)
        if (!/^\d{2}$/.test(month)) continue

        const monthPath = path.join(yearPath, month)
        const monthStat = await fs.stat(monthPath)
        if (!monthStat.isDirectory()) continue

        params.push({ year, month })
      }
    }

    return params
  } catch (error) {
    console.error("Error generating static params:", error)
    return []
  }
}

export default async function MonthlyContributionsPage({ params }: PageProps) {
  const { year, month } = await params

  // Validate year and month
  const yearNum = parseInt(year, 10)
  const monthNum = parseInt(month, 10)

  if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    notFound()
  }

  const monthName = MONTH_NAMES[monthNum - 1]

  // Read images and report data from static files
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data")

  let reportData: MonthlyReportData
  let imagesData: { images: any[] }

  try {
    // Read images from static file
    const imagesPath = path.join(dataDir, year, month, "channels", "discord", "images.json")
    if (!fs.existsSync(imagesPath)) {
      throw new Error(`Images file not found: ${imagesPath}`)
    }
    imagesData = JSON.parse(fs.readFileSync(imagesPath, "utf-8"))

    // Fetch report data from API (still needs API for financial data)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const reportResponse = await fetch(`${baseUrl}/api/reports/${year}/${month}`, {
      next: { revalidate: 86400 }
    })

    if (!reportResponse.ok) {
      throw new Error('Failed to fetch report data')
    }

    reportData = await reportResponse.json()
  } catch (error) {
    console.error(`Error loading monthly contributions for ${year}-${month}:`, error)
    notFound()
  }

  // Build user map
  const userMap: Record<string, { username: string; displayName: string }> = {}
  for (const user of reportData.activeMembers.users) {
    userMap[user.id] = {
      username: user.username,
      displayName: user.displayName || user.username
    }
  }

    return (
      <div className="min-h-screen bg-background">
        <main className="pt-24">
          <section className="py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
              {/* Header */}
              <div className="mb-8">
                <Button variant="ghost" size="sm" asChild className="mb-4">
                  <Link href="/contributions">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to All Contributions
                  </Link>
                </Button>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Contributions in {monthName} {year}
                </h1>
                <p className="text-muted-foreground max-w-2xl">
                  View all contributions from {monthName} {year}.
                </p>
              </div>

              {/* Contributors Grid */}
              <div className="mb-12">
                <h2 className="text-xl font-semibold text-foreground mb-6">
                  Active Contributors ({reportData.activeMembers.count})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {reportData.activeMembers.users.map((user) => (
                    <ContributorCard
                      key={user.id}
                      id={user.id}
                      username={user.username}
                      displayName={user.displayName || user.username}
                      avatar={user.avatar}
                      tokensReceived={user.tokensReceived}
                      tokensSpent={user.tokensSpent}
                    />
                  ))}
                </div>
              </div>

              {/* Image Gallery */}
              {imagesData.images.length > 0 ? (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-foreground">
                    Contributions ({imagesData.images.length})
                  </h2>
                  <DiscordImageGallery
                    images={imagesData.images.map((image) => ({
                      imageUrl: image.url,
                      author: {
                        id: image.author.id,
                        displayName: image.author.displayName || image.author.username,
                        avatar: image.author.avatar
                          ? `https://cdn.discordapp.com/avatars/${image.author.id}/${image.author.avatar}.png`
                          : null,
                      },
                      message: image.message,
                      timestamp: image.timestamp,
                      messageId: image.messageId,
                      channelId: image.channelId,
                      reactions: image.reactions,
                    }))}
                    showMessage={true}
                    thumbnailSize="md"
                    userMap={userMap}
                    channelMap={{}}
                    guildId={settings.discord.guildId}
                  />
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No contributions found for this month.
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    )
}
