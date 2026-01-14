import { NextResponse } from "next/server";
import settings from "@/settings/settings.json";

// Cache for 24 hours
let cache: { data: any; timestamp: number } | null = null;
let allCache: { data: any; timestamp: number } | null = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000;

interface NewsletterIssue {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  coverImage?: string;
}

async function fetchOgImage(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CommonshubBot/1.0)",
      },
    });
    if (!response.ok) return undefined;

    const html = await response.text();
    const ogImageMatch =
      html.match(
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
      ) ||
      html.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
      );

    if (ogImageMatch?.[1]) {
      return ogImageMatch[1].replace(/&amp;/g, "&");
    }
    return undefined;
  } catch {
    return undefined;
  }
}

async function fetchRSSFeed(limit?: number): Promise<NewsletterIssue[]> {
  const rssUrl = settings.newsletter.rssUrl;

  console.log(`[v0] Fetching RSS feed from: ${rssUrl}`);

  try {
    const response = await fetch(rssUrl, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml",
        "User-Agent": "Mozilla/5.0 (compatible; CommonshubBot/1.0)",
      },
    });

    console.log(`[v0] RSS response status: ${response.status}`);

    if (!response.ok) {
      console.error(`[v0] RSS fetch failed with status ${response.status}`);
      throw new Error("RSS fetch failed");
    }

    const text = await response.text();

    // Check if it's valid XML/RSS
    if (!text.includes("<rss") && !text.includes("<feed")) {
      throw new Error("Invalid RSS format");
    }

    // Parse ALL RSS items first
    const items: NewsletterIssue[] = [];
    const itemMatches = text.match(/<item>([\s\S]*?)<\/item>/g) || [];

    console.log(`[v0] Found ${itemMatches.length} items in RSS feed`);

    for (const itemXml of itemMatches) {
      const title =
        itemXml.match(
          /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/
        )?.[1] || "";
      const link =
        itemXml.match(
          /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/
        )?.[1] || "";
      const description =
        itemXml.match(
          /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/
        )?.[1] || "";
      const pubDate =
        itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";

      const enclosureMatch = itemXml.match(
        /<enclosure[^>]*url=["']([^"']+)["']/i
      );
      const coverImage = enclosureMatch?.[1];

      const cleanLink = link.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      const cleanDescription = description
        .replace(/<!\[CDATA\[|\]\]>/g, "")
        .replace(/<[^>]+>/g, "")
        .trim()
        .substring(0, 200);

      if (cleanTitle && cleanLink) {
        items.push({
          title: cleanTitle,
          link: cleanLink,
          description: cleanDescription,
          pubDate,
          coverImage,
        });
      }
    }

    // Sort by date descending (newest first)
    items.sort((a, b) => {
      const dateA = new Date(a.pubDate).getTime();
      const dateB = new Date(b.pubDate).getTime();
      return dateB - dateA;
    });

    console.log(
      `[v0] 5 latest posts JSON:`,
      JSON.stringify(
        items.slice(0, 5).map((item) => ({
          title: item.title,
          link: item.link,
          description: item.description.substring(0, 100),
          coverImage: item.coverImage || null,
        })),
        null,
        2
      )
    );

    // Take items based on limit
    const topItems = limit ? items.slice(0, limit) : items;

    // Fetch og:image for items without cover
    for (const item of topItems) {
      if (!item.coverImage && item.link) {
        console.log(`[v0] Fetching og:image for "${item.title}"`);
        item.coverImage = await fetchOgImage(item.link);
      }
    }

    if (topItems.length > 0) {
      return topItems;
    }
  } catch (error) {
    console.error(`[v0] Error fetching RSS:`, error);
  }

  // Fallback issues if RSS fails
  const fallbackIssues: NewsletterIssue[] = [
    {
      title: "Three months Commons Hub!",
      link: "https://paragraph.com/@commonshub_bxl/three-months-commons-hub",
      description:
        "A reflection on our first three months of operation, including furnishing the space, hosting events like the Regen Village, and establishing community foundations.",
      pubDate: "2024-10-01",
    },
    {
      title: "Welcome to Commons Hub Brussels",
      link: "https://paragraph.com/@commonshub_bxl/welcome-to-commons-hub-brussels",
      description:
        "The beginning of our journey to create a collaborative space for communities in Brussels.",
      pubDate: "2024-07-01",
    },
  ];

  // Fetch og:images for fallback issues
  for (const issue of fallbackIssues) {
    issue.coverImage = await fetchOgImage(issue.link);
  }

  return fallbackIssues;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "true";

  // Check appropriate cache
  const currentCache = all ? allCache : cache;
  if (currentCache && Date.now() - currentCache.timestamp < CACHE_DURATION) {
    return NextResponse.json(currentCache.data);
  }

  // Fetch 2 for homepage, all for /newsletter page
  const issues = await fetchRSSFeed(all ? undefined : 2);

  const data = {
    issues,
    subscribeUrl: settings.newsletter.subscribeUrl,
  };

  // Update appropriate cache
  if (all) {
    allCache = { data, timestamp: Date.now() };
  } else {
    cache = { data, timestamp: Date.now() };
  }

  return NextResponse.json(data);
}
