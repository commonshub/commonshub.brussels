"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DiscordImageGallery } from "@/components/discord-image-gallery";
import { Loader2, ArrowLeft, Star } from "lucide-react";

interface PhotoGalleryData {
  year: string;
  photos: Array<{
    url: string;
    author: {
      id: string;
      username: string;
      displayName: string | null;
      avatar: string | null;
    };
    reactions: Array<{ emoji: string; count: number; me?: boolean }>;
    totalReactions: number;
    message: string;
    timestamp: string;
    channelId: string;
    messageId: string;
  }>;
  activeMembers: {
    users: Array<{
      id: string;
      username: string;
      displayName: string | null;
    }>;
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const GUILD_ID = "1280532848604086365";

export default function YearlyPhotosPage() {
  const params = useParams();
  const year = params?.year as string;

  const [data, setData] = useState<PhotoGalleryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Validate params
    if (!/^\d{4}$/.test(year)) {
      setError("Invalid year format");
      setLoading(false);
      return;
    }

    fetch(`/api/reports/${year}/photos`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch photos");
        return res.json();
      })
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [year]);

  if (loading) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Photos</CardTitle>
            <CardDescription>{error || "Unable to load photo gallery"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Build userMap for mention resolution
  const userMap = Object.fromEntries(
    data.activeMembers.users.map((user) => [
      user.id,
      {
        username: user.username,
        displayName: user.displayName || user.username,
      },
    ])
  );

  // Group photos by month
  const photosByMonth = data.photos.reduce((acc, photo) => {
    const date = new Date(photo.timestamp);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(photo);
    return acc;
  }, {} as Record<string, typeof data.photos>);

  // Sort months in reverse chronological order (Dec to Jan)
  const sortedMonths = Object.keys(photosByMonth).sort().reverse();

  return (
    <div className="container mx-auto py-12 px-4 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href={`/${year}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {year} Annual Report
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold">{year} Photos</h1>
            <p className="text-muted-foreground">
              All photos from {year} organized by month ({data.photos.length} total)
            </p>
          </div>
          <Link
            href={`/${year}/photos/featured`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 hover:bg-yellow-500/20 transition-colors font-medium"
          >
            <Star className="h-4 w-4 fill-current" />
            Featured Photos
          </Link>
        </div>
      </div>

      {/* Month Navigation */}
      {sortedMonths.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              {sortedMonths.map((monthKey) => {
                const [, month] = monthKey.split('-');
                const monthIndex = parseInt(month, 10) - 1;
                const monthName = MONTH_NAMES[monthIndex];
                const photoCount = photosByMonth[monthKey].length;
                return (
                  <a
                    key={monthKey}
                    href={`#month-${monthKey}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                  >
                    <span className="font-medium">{monthName}</span>
                    <span className="text-sm text-muted-foreground">({photoCount})</span>
                  </a>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photo Gallery by Month */}
      {sortedMonths.length > 0 ? (
        <div className="space-y-12">
          {sortedMonths.map((monthKey) => {
            const [, month] = monthKey.split('-');
            const monthIndex = parseInt(month, 10) - 1;
            const monthName = MONTH_NAMES[monthIndex];
            const monthPhotos = photosByMonth[monthKey];

            return (
              <section key={monthKey} id={`month-${monthKey}`} className="scroll-mt-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold">{monthName} {year}</h2>
                    <p className="text-muted-foreground">{monthPhotos.length} photos</p>
                  </div>
                  <Link
                    href={`/${year}/${month}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    View monthly report →
                  </Link>
                </div>
                <DiscordImageGallery
                  images={monthPhotos.map((photo) => ({
                    imageUrl: photo.url,
                    author: {
                      id: photo.author.id,
                      displayName: photo.author.displayName || photo.author.username,
                      avatar: photo.author.avatar
                        ? `https://cdn.discordapp.com/avatars/${photo.author.id}/${photo.author.avatar}.png`
                        : null,
                    },
                    message: photo.message,
                    timestamp: photo.timestamp,
                    messageId: photo.messageId,
                    channelId: photo.channelId,
                    reactions: photo.reactions,
                  }))}
                  showMessage={true}
                  thumbnailSize="md"
                  userMap={userMap}
                  channelMap={{}}
                  guildId={GUILD_ID}
                />
              </section>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No photos found for this year
          </CardContent>
        </Card>
      )}
    </div>
  );
}
