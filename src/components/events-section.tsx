"use client";

import { useEffect, useState } from "react";
import Image from "@/components/optimized-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Star, Rss, Mail } from "lucide-react";
import Link from "next/link";
import settings from "@/settings/settings.json";
import { displayUrl } from "@/lib/utils";
interface EventTag {
  name: string;
  color: string;
}

interface LumaEvent {
  id: string;
  name: string;
  description: string;
  start_at: string;
  end_at: string;
  cover_url: string;
  url: string;
  location?: string;
  isExternal: boolean;
  externalPlatform?: string;
  externalUrl?: string;
  tags?: EventTag[];
  isFeatured?: boolean;
}

function EventCard({
  event,
  onTagClick,
  size = "normal",
}: {
  event: LumaEvent;
  onTagClick: (tag: string) => void;
  size?: "normal" | "large";
}) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isLarge = size === "large";
  const eventUrl = event.isExternal ? event.externalUrl : event.url;

  // Helper function to shorten URLs in text
  const shortenUrlsInText = (text: string): string => {
    const urlRegex = /https?:\/\/[^\s]+/g;
    return text.replace(urlRegex, (url) => displayUrl(url, 40));
  };

  // Get first 2 lines of description (roughly 150 chars) and shorten any URLs
  const shortDescription = event.description
    ? shortenUrlsInText(
        event.description.substring(0, 150).replace(/\n/g, " ").trim()
      ) + (event.description.length > 150 ? "..." : "")
    : "";

  return (
    <a
      href={eventUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <Card
        className={`overflow-hidden group hover:shadow-lg transition-all cursor-pointer h-full ${isLarge ? "md:col-span-2 lg:col-span-1" : ""}`}
      >
        <div
          className={`relative overflow-hidden bg-muted ${isLarge ? "h-64" : "h-48"}`}
        >
          {event.cover_url ? (
            <Image
              src={`/api/image-proxy?url=${encodeURIComponent(event.cover_url)}`}
              alt={event.name}
              fill
              sizes={
                isLarge
                  ? "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  : "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              }
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10">
              <Calendar className="w-12 h-12 text-primary/40" />
            </div>
          )}
          <div className="absolute top-4 left-4 flex flex-col items-start gap-2">
            <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
              {formatDate(event.start_at)} · {formatTime(event.start_at)}
            </div>
            {event.tags && event.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {event.tags
                  .filter((tag) => tag.name.toLowerCase() !== "featured")
                  .map((tag) => (
                    <span
                      key={tag.name}
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-opacity hover:opacity-80 shadow-sm"
                      style={{
                        backgroundColor: tag.color || "#6b7280",
                        color: isLightColor(tag.color) ? "#000" : "#fff",
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onTagClick(tag.name);
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>
        <CardHeader className="py-3 pb-0">
          <CardTitle className={`${isLarge ? "text-xl" : ""} line-clamp-2 break-words`}>
            {event.name}
          </CardTitle>
          {event.location && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="break-words">{event.location}</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-1 pb-3">
          {shortDescription && (
            <p className="text-sm text-muted-foreground line-clamp-2 break-words">
              {shortDescription}
            </p>
          )}
        </CardContent>
      </Card>
    </a>
  );
}

function isLightColor(color: string): boolean {
  if (!color) return false;
  const hex = color.replace("#", "");
  if (hex.length !== 6) return false;
  const r = Number.parseInt(hex.substring(0, 2), 16);
  const g = Number.parseInt(hex.substring(2, 4), 16);
  const b = Number.parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

export function EventsSection() {
  const [events, setEvents] = useState<LumaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch("/api/events");
        const data = await response.json();
        setEvents(data.events || []);
      } catch (error) {
        console.error("Failed to fetch events:", error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const featuredEvents = events.filter((event) => event.isFeatured);
  const regularEvents = events.filter((event) => !event.isFeatured);

  const tagCounts = events.reduce(
    (acc, event) => {
      (event.tags || [])
        .filter((tag) => tag.name.toLowerCase() !== "featured")
        .forEach((tag) => {
          if (!acc[tag.name]) {
            acc[tag.name] = { count: 0, color: tag.color };
          }
          acc[tag.name].count++;
        });
      return acc;
    },
    {} as Record<string, { count: number; color: string }>
  );

  const popularTags = Object.entries(tagCounts)
    .filter(([_, data]) => data.count >= 2)
    .sort((a, b) => b[1].count - a[1].count);

  const filteredEvents = selectedTag
    ? regularEvents.filter((event) =>
        event.tags?.some((t) => t.name === selectedTag)
      )
    : regularEvents;

  return (
    <section id="events" className="py-24 bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {!loading && featuredEvents.length > 0 && (
          <div className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground flex items-center justify-center gap-3">
                <Star className="w-8 h-8 text-amber-500 fill-amber-500" />
                Featured Events
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                Don't miss these highlighted events handpicked by our community.
              </p>
            </div>
            <div
              className={`grid gap-6 ${featuredEvents.length === 1 ? "max-w-lg mx-auto" : featuredEvents.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : "md:grid-cols-2 lg:grid-cols-3"}`}
            >
              {featuredEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onTagClick={setSelectedTag}
                  size="large"
                />
              ))}
            </div>
          </div>
        )}

        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Upcoming Events
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Join our community events, workshops, and gatherings. There's always
            something happening at Commons Hub.
          </p>
        </div>

        {!loading && popularTags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                selectedTag === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              All Events
            </button>
            {popularTags.map(([tag, data]) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer flex items-center gap-2 ${
                  selectedTag === tag ? "" : "opacity-70 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: data.color || "#6b7280",
                  color: isLightColor(data.color) ? "#000" : "#fff",
                }}
              >
                {tag}
                <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                  {data.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-t-lg" />
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {selectedTag
                ? `No upcoming events with tag "${selectedTag}". Try another filter or check back soon!`
                : "No upcoming events at the moment. Check back soon!"}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.slice(0, 6).map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onTagClick={setSelectedTag}
              />
            ))}
          </div>
        )}

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            variant="outline"
            className="gap-2 bg-transparent cursor-pointer"
            asChild
          >
            <a
              href="https://lu.ma/commonshub_bxl"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Calendar className="w-5 h-5" />
              View All Events on Luma
            </a>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="gap-2 bg-transparent cursor-pointer"
            asChild
          >
            <a
              href="https://api2.luma.com/ics/get?entity=calendar&id=cal-kWlIiw3HsJFhs25"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Rss className="w-5 h-5" />
              Subscribe to Calendar
            </a>
          </Button>
          <Button
            size="lg"
            variant="default"
            className="gap-2 cursor-pointer"
            asChild
          >
            <Link
              href={
                settings?.newsletter?.subscribeUrl ||
                "https://paragraph.com/@commonshub_bxl"
              }
            >
              <Mail className="w-5 h-5" />
              Subscribe to our Newsletter
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
