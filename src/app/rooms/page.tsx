import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight, Coins } from "lucide-react";
import roomsData from "@/settings/rooms.json";

export const metadata = {
  title: "Our Rooms | Commons Hub Brussels",
  description:
    "Explore our versatile spaces for events, workshops, meetings, and community gatherings.",
};

export default function RoomsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <section className="py-24 bg-linear-to-b from-primary/10 to-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
                Our Spaces
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Discover our versatile rooms designed for community gatherings,
                workshops, meetings, and events of all kinds.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {roomsData.rooms.map((room) => (
                <Card
                  key={room.id}
                  className="overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="relative h-48">
                    <Image
                      src={room.heroImage || "/placeholder.svg"}
                      alt={room.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {room.name}
                      <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                        <Users className="w-4 h-4" />
                        {room.capacity}
                      </span>
                    </CardTitle>
                    <CardDescription>{room.shortDescription}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      {room.pricePerHour > 0 ? (
                        <>
                          <span className="font-semibold">
                            €{room.pricePerHour}/hour
                          </span>
                          <span className="text-muted-foreground flex items-center gap-1 text-sm">
                            <Coins className="w-4 h-4 text-primary" />
                            {room.tokensPerHour} token
                            {room.tokensPerHour > 1 ? "s" : ""}/hour
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Members only
                        </span>
                      )}
                    </div>
                    <Link href={`/rooms/${room.slug}`}>
                      <Button className="w-full gap-2 cursor-pointer">
                        View Details
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
