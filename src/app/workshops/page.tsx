import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar, Clock, Users, ArrowRight, Euro } from "lucide-react";
import Image from "@/components/optimized-image";
import Link from "next/link";
import { getAllCalendarEvents } from "@/lib/luma";
import settings from "@/settings/settings.json";
import { format, parseISO } from "date-fns";

interface Workshop {
  title: string;
  description: string;
  duration?: string;
  participants?: string;
  price?: string;
  category?: string;
  href?: string;
  image?: string;
  featured?: boolean;
  nextDate?: string;
  rsvpUrl?: string;
}

const staticWorkshops: Workshop[] = [
  {
    title: "The Commons Game",
    description:
      "A great interactive game to discover what it takes to manage together a common resource.",
    duration: "2 hours",
    participants: "4-16",
    price: "25€/person or 350€/group",
    category: "Interactive Game",
    href: "/workshops/commons-game",
    image: "/images/img-0435-202.jpeg",
    featured: true,
  },
  {
    title: "Lego Serious Play",
    description:
      "Three horizon meets Lego Serious Play. A future exploration to set your intentions beyond the New Year",
    duration: "3 hours",
    participants: "Limited spaces",
    price: "€60 early bird",
    category: "Futures & Intention Setting",
    href: "/workshops/lego-serious-play",
    image: "/images/workshops/legoworkshop-cover.jpg",
    featured: false,
    nextDate: "16 January 2026",
    rsvpUrl: "https://luma.com/v7qklcet",
  },
];

async function fetchLumaWorkshops(): Promise<Workshop[]> {
  const calendarId = settings.luma.calendarId;
  if (!calendarId || !process.env.LUMA_API_KEY) {
    return [];
  }

  try {
    const now = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(now.getFullYear() + 1);

    const entries = await getAllCalendarEvents(
      calendarId,
      now.toISOString(),
      oneYearFromNow.toISOString()
    );

    // The API returns entries with structure { api_id, event: {...}, tags: [...] }
    // Filter events with "workshop" tag
    const workshopEntries = entries.filter((entry: any) => {
      const tags = entry.tags || [];
      return tags.some(
        (tag: any) =>
          (typeof tag === "string" && tag.toLowerCase() === "workshop") ||
          (typeof tag === "object" &&
            tag.name &&
            tag.name.toLowerCase() === "workshop")
      );
    });

    // Convert Luma events to workshop format
    return workshopEntries.map((entry: any) => {
      // Handle both nested structure { event: {...}, tags: [...] } and flat structure
      const event = entry.event || entry;
      const startDate = event.start_at ? parseISO(event.start_at) : null;
      const endDate = event.end_at ? parseISO(event.end_at) : null;

      // Calculate duration
      let duration: string | undefined;
      if (startDate && endDate) {
        const diffMs = endDate.getTime() - startDate.getTime();
        const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
        if (diffHours < 1) {
          const diffMins = Math.round(diffMs / (1000 * 60));
          duration = `${diffMins} minutes`;
        } else if (diffHours === 1) {
          duration = "1 hour";
        } else {
          duration = `${diffHours} hours`;
        }
      }

      // Format date
      const nextDate = startDate ? format(startDate, "d MMMM yyyy") : undefined;

      // Extract short description (first sentence or first 150 chars)
      let description = event.description || "";
      const firstSentence = description.split(/[.!?]/)[0];
      if (firstSentence.length > 0 && firstSentence.length < 200) {
        description = firstSentence;
      } else {
        description = description.substring(0, 150).trim();
        if (description.length === 150) {
          description += "...";
        }
      }

      return {
        title: event.name,
        description,
        duration,
        participants: event.capacity
          ? `Up to ${event.capacity}`
          : "Limited spaces",
        category: "Workshop",
        image: event.cover_url,
        featured: false,
        nextDate,
        rsvpUrl: event.url,
      };
    });
  } catch (error) {
    console.error("Error fetching Luma workshops:", error);
    return [];
  }
}

export default async function WorkshopsPage() {
  const lumaWorkshops = await fetchLumaWorkshops();
  const allWorkshops = [...staticWorkshops, ...lumaWorkshops];
  const featuredWorkshop = allWorkshops.find((w) => w.featured);
  const otherWorkshops = allWorkshops.filter((w) => !w.featured);

  return (
    <main className="min-h-screen">
      <section className="pt-32 pb-16 bg-primary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground">
              Workshops
            </h1>
            <p className="mt-6 text-xl text-muted-foreground">
              Develop new skills, explore ideas, and connect with fellow
              practitioners through our hands-on workshops led by experienced
              facilitators.
            </p>
          </div>
        </div>
      </section>

      {featuredWorkshop && (
        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-foreground mb-8">
              Featured Workshop
            </h2>
            <Card className="overflow-hidden">
              <div className="grid md:grid-cols-2">
                <div className="relative h-64 md:h-auto">
                  <Image
                    src={featuredWorkshop.image! || "/placeholder.svg"}
                    alt={featuredWorkshop.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-8">
                  <div className="text-xs font-medium text-primary uppercase tracking-wider mb-2">
                    {featuredWorkshop.category}
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-4">
                    {featuredWorkshop.title}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {featuredWorkshop.description}
                  </p>
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {featuredWorkshop.duration}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      {featuredWorkshop.participants} participants
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Euro className="w-4 h-4" />
                      {featuredWorkshop.price}
                    </div>
                  </div>
                  <Button className="gap-2 cursor-pointer" asChild>
                    {featuredWorkshop.rsvpUrl ? (
                      <a
                        href={featuredWorkshop.rsvpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        RSVP
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    ) : (
                      <Link href={featuredWorkshop.href!}>
                        Learn More & Book
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </section>
      )}

      {otherWorkshops.length > 0 && (
        <section className="py-16 bg-primary/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-foreground mb-8">
              More Workshops
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherWorkshops.map((workshop, i) => (
                <Card key={i} className="flex flex-col">
                  {workshop.image && (
                    <div className="relative h-48 w-full">
                      <Image
                        src={workshop.image}
                        alt={workshop.title}
                        fill
                        className="object-cover rounded-t-lg"
                        unoptimized={workshop.image.startsWith("http")}
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="text-xs font-medium text-primary uppercase tracking-wider mb-2">
                      {workshop.category || "Workshop"}
                    </div>
                    <CardTitle>{workshop.title}</CardTitle>
                    <CardDescription>{workshop.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <div className="space-y-2 mb-6 flex-1">
                      {workshop.nextDate && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          {workshop.nextDate}
                        </div>
                      )}
                      {workshop.duration && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {workshop.duration}
                        </div>
                      )}
                      {workshop.participants && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="w-4 h-4" />
                          {workshop.participants}
                        </div>
                      )}
                      {workshop.price && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Euro className="w-4 h-4" />
                          {workshop.price}
                        </div>
                      )}
                    </div>
                    <Button className="w-full gap-2 cursor-pointer" asChild>
                      {workshop.rsvpUrl ? (
                        <a
                          href={workshop.rsvpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          RSVP
                          <ArrowRight className="w-4 h-4" />
                        </a>
                      ) : workshop.href ? (
                        <Link href={workshop.href}>
                          Learn More
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      ) : (
                        <a
                          href={`mailto:hello@commonshub.brussels?subject=Workshop Registration: ${workshop.title}`}
                        >
                          Register Interest
                          <ArrowRight className="w-4 h-4" />
                        </a>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-16 text-center bg-card border border-border rounded-xl p-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Want to host your own workshop?
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
                We welcome facilitators who want to share their expertise with
                our community. Get in touch to discuss how we can collaborate.
              </p>
              <Button
                variant="outline"
                className="cursor-pointer bg-transparent"
                asChild
              >
                <a href="mailto:hello@commonshub.brussels?subject=Workshop Hosting Inquiry">
                  Get in Touch
                </a>
              </Button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
