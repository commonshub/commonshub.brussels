import { Metadata } from "next";
import { RoomCalendar } from "./room-calendar";

export const metadata: Metadata = {
  title: "Room Calendar | Commons Hub Brussels",
  description: "View room availability across all spaces at Commons Hub Brussels. Find the perfect time for your event.",
};

export default function CalendarPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 py-8 md:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
              Room Calendar
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Check room availability and plan your next event at Commons Hub Brussels.
            </p>
          </div>
          
          <RoomCalendar />
        </div>
      </main>
    </div>
  );
}
