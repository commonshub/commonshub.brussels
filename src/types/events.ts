/**
 * Events data types
 * Generated from data/{year}/{month}/events.json
 */

export interface EventMetadata {
  host?: string;
  attendance?: number;
  fridgeIncome?: number;
  rentalIncome?: number;
  ticketsSold?: number;
  ticketRevenue?: number;
  note?: string;
}

export interface EventGuest {
  name: string;
  avatar_url?: string;
  approval_status: string;
}

export interface LumaEvent {
  api_id: string;
  name: string;
  start_at: string;
  end_at?: string;
  url: string;
  cover_url?: string;
  description?: string;
  location?: string;
  timezone?: string;
  [key: string]: any;
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  startAt: string;
  endAt?: string;
  timezone?: string;
  location?: string;
  url?: string;
  coverImage?: string;
  coverImageLocal?: string;
  source: "luma" | "ical";
  calendarSource?: "luma-api" | "luma" | "google";
  lumaData?: LumaEvent;
  guests?: EventGuest[];
  metadata: EventMetadata;
}

export interface EventsFile {
  month: string;
  generatedAt: string;
  events: Event[];
}
