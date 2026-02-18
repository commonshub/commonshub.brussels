import { Metadata } from "next";
import { RoomCalendar } from "./room-calendar";

export const metadata: Metadata = {
  title: "Calendar | Commons Hub Brussels",
  description:
    "View room bookings across all spaces at Commons Hub Brussels.",
};

export default function CalendarPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 py-6 md:py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <RoomCalendar />
        </div>
      </main>
    </div>
  );
}
