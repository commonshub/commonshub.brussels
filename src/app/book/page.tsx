"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingForm } from "@/components/booking-form";

function BookingPageContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room");
  const dateParam = searchParams.get("date");

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Link href="/calendar">
              <Button variant="ghost" size="sm" className="gap-2 cursor-pointer mb-4">
                <ArrowLeft className="w-4 h-4" />
                Back to Calendar
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-bold">Book a Room</h1>
            </div>
            <p className="text-muted-foreground mt-2">
              Fill out the form below and we&apos;ll get back to you to confirm your booking.
            </p>
          </div>

          <BookingForm 
            preselectedRoomId={roomId || undefined} 
            preselectedDate={dateParam || undefined}
          />
        </div>
      </main>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    }>
      <BookingPageContent />
    </Suspense>
  );
}
