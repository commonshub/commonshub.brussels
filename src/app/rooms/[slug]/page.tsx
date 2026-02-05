import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Users, Coins, Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import roomsData from "@/settings/rooms.json";
import { RoomBookingForm } from "@/components/room-booking-form";
import { CommunityActivityGallery } from "@/components/community-activity-gallery";
interface RoomPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return roomsData.rooms.map((room) => ({
    slug: room.slug,
  }));
}

export async function generateMetadata({ params }: RoomPageProps) {
  const { slug } = await params;
  const room = roomsData.rooms.find((r) => r.slug === slug);

  if (!room) {
    return { title: "Room Not Found" };
  }

  return {
    title: `${room.name} | Commons Hub Brussels`,
    description: room.description,
  };
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { slug } = await params;
  const room = roomsData.rooms.find((r) => r.slug === slug);
  if (!room) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative h-[40vh] min-h-[300px]">
          <Image
            src={room.heroImage || "/placeholder.svg"}
            alt={room.name}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <div className="max-w-7xl mx-auto">
              <Link href="/rooms">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-4 gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  All Rooms
                </Button>
              </Link>
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-2">
                {room.name}
              </h1>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="w-5 h-5" />
                  Up to {room.capacity} people
                </span>
                {room.pricePerHour > 0 && (
                  <>
                    <span className="font-semibold text-foreground">
                      €{room.pricePerHour}/hour
                    </span>
                    <span className="flex items-center gap-1">
                      <Coins className="w-5 h-5 text-primary" />
                      {room.tokensPerHour} token
                      {room.tokensPerHour > 1 ? "s" : ""}/hour
                    </span>
                  </>
                )}
                {room.membershipRequired && (
                  <Badge variant="secondary">Members Only</Badge>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-3 gap-12">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-12">
                {/* Description */}
                <div>
                  <h2 className="text-2xl font-bold mb-4">About this space</h2>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    {room.description}
                  </p>
                </div>

                {/* Features */}
                <div>
                  <h2 className="text-2xl font-bold mb-4">Features</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {room.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2">
                        <Check className="w-5 h-5 text-primary flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ideal For */}
                <div>
                  <h2 className="text-2xl font-bold mb-4">Ideal for</h2>
                  <div className="flex flex-wrap gap-2">
                    {room.idealFor.map((use) => (
                      <Badge
                        key={use}
                        variant="outline"
                        className="text-sm py-1 px-3"
                      >
                        {use}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Community Photos */}
                <div>
                  <h2 className="text-2xl font-bold mb-4">Community Photos</h2>
                  <p className="text-muted-foreground mb-6">
                    Photos shared by our community members from events and
                    gatherings in this space.
                  </p>
                  <CommunityActivityGallery
                    channelId={room.discordChannelId}
                    maxImages={18}
                  />
                </div>
              </div>

              {/* Sidebar - Booking Form */}
              <div className="lg:col-span-1">
                <div className="sticky top-24">
                  <RoomBookingForm
                    roomId={room.id}
                    roomName={room.name}
                    pricePerHour={room.pricePerHour}
                    tokensPerHour={room.tokensPerHour}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
