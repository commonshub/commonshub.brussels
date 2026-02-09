import { NextRequest, NextResponse } from "next/server";
import { fetchRoomEventsForRange, getRoomsSortedByCapacity } from "@/lib/room-calendar";

export const dynamic = 'force-dynamic';
export const revalidate = 300; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    
    // Default to current month if no dates provided
    const now = new Date();
    const start = startParam 
      ? new Date(startParam) 
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endParam 
      ? new Date(endParam) 
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const events = await fetchRoomEventsForRange(start, end);
    const rooms = getRoomsSortedByCapacity();
    
    // Convert dates to ISO strings for JSON serialization
    const serializedEvents = events.map(event => ({
      ...event,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
    }));
    
    return NextResponse.json({
      events: serializedEvents,
      rooms: rooms.map(room => ({
        id: room.id,
        name: room.name,
        slug: room.slug,
        capacity: room.capacity,
      })),
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching room events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch room events' },
      { status: 500 }
    );
  }
}
