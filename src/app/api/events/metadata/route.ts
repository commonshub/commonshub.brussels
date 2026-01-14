import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

interface EventMetadataUpdate {
  id: string;
  metadata: {
    host?: string;
    attendance?: number;
    ticketRevenue?: number;
    fridgeIncome?: number;
    rentalIncome?: number;
    ticketsSold?: number;
    note?: string;
  };
}

interface RequestBody {
  year: string;
  month: string;
  events: EventMetadataUpdate[];
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { year, month, events: updatedEvents } = body;

    // Validate input
    if (!year || !month || !updatedEvents) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Read the existing events file
    const eventsPath = path.join(DATA_DIR, year, month, "events.json");

    if (!fs.existsSync(eventsPath)) {
      return NextResponse.json(
        { error: "Events file not found" },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(eventsPath, "utf-8");
    const eventsData = JSON.parse(fileContent);

    // Create a map of updated metadata
    const metadataMap = new Map(
      updatedEvents.map(e => [e.id, e.metadata])
    );

    // Update events with new metadata
    eventsData.events = eventsData.events.map((event: any) => {
      if (metadataMap.has(event.id)) {
        const newMetadata = metadataMap.get(event.id);
        return {
          ...event,
          metadata: {
            ...event.metadata,
            ...newMetadata
          }
        };
      }
      return event;
    });

    // Update generatedAt timestamp
    eventsData.generatedAt = new Date().toISOString();

    // Write back to file
    fs.writeFileSync(eventsPath, JSON.stringify(eventsData, null, 2), "utf-8");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating event metadata:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
