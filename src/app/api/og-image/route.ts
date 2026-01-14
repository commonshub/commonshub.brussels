import { type NextRequest, NextResponse } from "next/server"

// Cache for 24 hours
const ogImageCache: Map<string, { imageUrl: string; timestamp: number }> = new Map()
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours in ms

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
  }

  // Check cache
  const cached = ogImageCache.get(url)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json({ imageUrl: cached.imageUrl, cached: true })
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CommonsHubBot/1.0)",
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch page" }, { status: response.status })
    }

    const html = await response.text()

    // Extract og:image from HTML
    let ogImage = ""

    // Try og:image first
    const ogImageMatch =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)

    if (ogImageMatch) {
      ogImage = ogImageMatch[1]
    }

    // Fallback to twitter:image
    if (!ogImage) {
      const twitterImageMatch =
        html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i)

      if (twitterImageMatch) {
        ogImage = twitterImageMatch[1]
      }
    }

    // Handle relative URLs
    if (ogImage && !ogImage.startsWith("http")) {
      const baseUrl = new URL(url)
      ogImage = new URL(ogImage, baseUrl.origin).href
    }

    if (ogImage) {
      ogImage = decodeHtmlEntities(ogImage)
    }

    // Cache the result
    ogImageCache.set(url, { imageUrl: ogImage, timestamp: Date.now() })

    return NextResponse.json({ imageUrl: ogImage, cached: false })
  } catch (error) {
    console.error("[v0] Failed to fetch og:image:", error)
    return NextResponse.json({ error: "Failed to fetch og:image", imageUrl: "" }, { status: 500 })
  }
}
