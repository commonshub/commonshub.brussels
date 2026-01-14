"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DiscordImageGallery } from "@/components/discord-image-gallery";
import { Loader2, ArrowLeft } from "lucide-react";

interface PhotoGalleryData {
  year: string;
  month: string;
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

export default function MonthlyPhotosPage() {
  const params = useParams();
  const year = params?.year as string;
  const month = params?.month as string;

  const [data, setData] = useState<PhotoGalleryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Validate params
    if (!/^\d{4}$/.test(year) || !/^(0[1-9]|1[0-2])$/.test(month)) {
      setError("Invalid year or month format");
      setLoading(false);
      return;
    }

    fetch(`/api/reports/${year}/${month}/photos`)
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
  }, [year, month]);

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

  const monthName = MONTH_NAMES[parseInt(month, 10) - 1];

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

  return (
    <div className="container mx-auto py-12 px-4 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href={`/${year}/${month}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {monthName} {year} Report
        </Link>
        <div>
          <h1 className="text-4xl font-bold">{monthName} {year} Photos</h1>
          <p className="text-muted-foreground">
            All photos from {monthName} {year} in chronological order ({data.photos.length} total)
          </p>
        </div>
      </div>

      {/* Photo Gallery */}
      {data.photos.length > 0 ? (
        <DiscordImageGallery
          images={data.photos.map((photo) => ({
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
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No photos found for this month
          </CardContent>
        </Card>
      )}
    </div>
  );
}
