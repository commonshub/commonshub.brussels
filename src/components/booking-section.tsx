"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Users, Coins } from "lucide-react"
import { BookingDialog } from "@/components/booking-dialog"

const rooms = [
  {
    id: "mush",
    slug: "mushroom",
    name: "Mush Room",
    capacity: 10,
    description: "Perfect for small meetings",
    pricePerHour: 25,
    tokensPerHour: 1,
    image: "/images/mush-room.jpg",
  },
  {
    id: "angel",
    slug: "angel",
    name: "Angel Room",
    capacity: 12,
    description: "Perfect for circles",
    pricePerHour: 35,
    tokensPerHour: 1,
    image: "/images/angel-room.jpeg",
  },
  {
    id: "satoshi",
    slug: "satoshi",
    name: "Satoshi Room",
    capacity: 15,
    description: "Perfect for larger meetings",
    pricePerHour: 50,
    tokensPerHour: 1.5,
    image: "/images/satoshi-room.jpg",
  },
  {
    id: "ostrom",
    slug: "ostrom",
    name: "Ostrom Room",
    capacity: 80,
    description: "Perfect for events, big circles, panels, fishbowls, facilitation...",
    pricePerHour: 100,
    tokensPerHour: 3,
    image: "/images/img-2144.jpeg",
  },
]

export { rooms }

export function BookingSection() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)

  const handleBookRoom = (roomId: string) => {
    setSelectedRoom(roomId)
    setDialogOpen(true)
  }

  return (
    <section id="book" className="py-24 bg-primary/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Book Our Space</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Bring your community together in our versatile spaces. Perfect for events, workshops, meetings, and
            gatherings of all kinds.
          </p>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl mx-auto">
            Members enjoy a 30% discount and priority booking. They can also use tokens earned from community
            contributions.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {rooms.map((room) => (
            <Card key={room.id} className="relative overflow-hidden flex flex-col">
              {room.image && (
                <Link href={`/rooms/${room.slug}`} className="block">
                  <div className="relative h-40 w-full overflow-hidden">
                    <Image
                      src={room.image || "/placeholder.svg"}
                      alt={room.name}
                      fill
                      className="object-cover transition-transform hover:scale-105"
                    />
                  </div>
                </Link>
              )}
              <CardHeader>
                <Link href={`/rooms/${room.slug}`} className="hover:text-primary transition-colors">
                  <CardTitle className="text-xl">{room.name}</CardTitle>
                </Link>
                <CardDescription className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  Up to {room.capacity} people
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <p className="text-sm text-muted-foreground mb-4">{room.description}</p>
                <div className="mt-auto space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">€{room.pricePerHour}/hour</span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Coins className="w-4 h-4 text-primary" />
                      {room.tokensPerHour} token{room.tokensPerHour > 1 ? "s" : ""}/hour
                    </span>
                  </div>
                  <Button asChild className="w-full gap-2 cursor-pointer">
                    <Link href={`/rooms/${room.slug}`}>
                      View room details
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/rooms" className="text-primary hover:underline mr-4">
            View all rooms
          </Link>
          <span className="text-muted-foreground">
            Need a custom setup or have specific requirements?{" "}
            <a href="mailto:hello@commonshub.brussels" className="text-primary hover:underline">
              Get in touch
            </a>
          </span>
        </div>
      </div>

      <BookingDialog open={dialogOpen} onOpenChange={setDialogOpen} preselectedRoom={selectedRoom} />
    </section>
  )
}
