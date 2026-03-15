/**
 * Luma API helper
 * https://docs.luma.com/reference/getting-started-with-your-api
 */

const LUMA_API_BASE_URL = "https://public-api.luma.com";
const LUMA_API_KEY = process.env.LUMA_API_KEY;

export interface LumaEventLocation {
  type?: string;
  place_id?: string;
  description?: string;
  address?: string;
}

export interface LumaEvent {
  api_id: string;
  name: string;
  description?: string;
  start_at: string; // ISO 8601 datetime
  end_at?: string; // ISO 8601 datetime
  timezone: string;
  url: string;
  cover_url?: string;
  geo_address_json?: LumaEventLocation;
  meeting_url?: string;
  require_rsvp_approval?: boolean;
  visibility?: string;
  event_type?: string;
  capacity?: number;
  guest_count?: number;
  hosts?: Array<{ name: string; api_id?: string }>;
  hosted_by?: string;
  series_api_id?: string;
  tags?: string[];
}

export interface LumaCalendarEventsResponse {
  entries: LumaEvent[];
  has_more: boolean;
  next_cursor?: string;
}

/**
 * Fetch a single event by ID
 */
export async function getEvent(eventId: string): Promise<LumaEvent | null> {
  if (!LUMA_API_KEY) {
    console.warn("LUMA_API_KEY not set, skipping Luma API call");
    return null;
  }

  try {
    const response = await fetch(`${LUMA_API_BASE_URL}/v1/event/get?api_id=${eventId}`, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-luma-api-key": LUMA_API_KEY,
      },
    });

    if (!response.ok) {
      // 403 = community event we don't own, 404 = deleted — both expected
      if (response.status === 403 || response.status === 404) {
        return null;
      }
      const errorText = await response.text();
      throw new Error(`Luma API error: ${response.status} ${response.statusText} – ${errorText}`);
    }

    const data = await response.json();
    return data.event || data;
  } catch (error) {
    console.error(`Error fetching Luma event ${eventId}:`, error);
    return null;
  }
}

/**
 * List events for a calendar
 */
export async function listCalendarEvents(
  calendarId: string,
  options: {
    after?: string; // ISO 8601 datetime
    before?: string; // ISO 8601 datetime
    cursor?: string;
  } = {}
): Promise<LumaCalendarEventsResponse | null> {
  if (!LUMA_API_KEY) {
    console.warn("LUMA_API_KEY not set, skipping Luma API call");
    return null;
  }

  try {
    const params = new URLSearchParams({
      sort_column: "start_at",
    });

    if (options.after) params.append("after", options.after);
    if (options.before) params.append("before", options.before);
    if (options.cursor) params.append("pagination_cursor", options.cursor);

    const response = await fetch(`${LUMA_API_BASE_URL}/v1/calendar/list-events?${params}`, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-luma-api-key": LUMA_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Luma API error: ${response.status} ${response.statusText}`);
      console.error(`Response: ${errorText}`);
      throw new Error(`Luma API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      entries: data.entries || [],
      has_more: data.has_more || false,
      next_cursor: data.next_cursor,
    };
  } catch (error) {
    console.error(`Error listing Luma calendar events for ${calendarId}:`, error);
    return null;
  }
}

/**
 * Fetch all events for a calendar in a given time range
 */
export async function getAllCalendarEvents(
  calendarId: string,
  after: string,
  before: string
): Promise<LumaEvent[]> {
  const allEvents: LumaEvent[] = [];
  let cursor: string | undefined;

  do {
    const response = await listCalendarEvents(calendarId, {
      after,
      before,
      cursor,
    });

    if (!response) {
      break;
    }

    allEvents.push(...response.entries);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return allEvents;
}

export interface LumaEventTicket {
  amount: number; // Price in cents
  amount_discount: number;
  amount_tax: number;
  id: string;
  api_id: string;
  checked_in_at: string | null;
  currency: string;
  event_ticket_type_id: string;
  is_captured: boolean;
  name: string;
}

export interface LumaGuest {
  api_id: string;
  guest: {
    api_id: string;
    approval_status: string;
    name: string;
    email?: string;
    user_name?: string;
    avatar_url?: string;
    event_ticket?: {
      amount?: number; // Price in cents
      currency?: string;
      name?: string;
    };
    event_tickets?: LumaEventTicket[];
  };
}

/**
 * Fetch guests for an event
 * Returns all guests to allow for ticket statistics computation
 */
export async function getEventGuests(eventId: string): Promise<LumaGuest[]> {
  if (!LUMA_API_KEY) {
    console.warn("LUMA_API_KEY not set, skipping guest fetch");
    return [];
  }

  try {
    const response = await fetch(
      `${LUMA_API_BASE_URL}/v1/event/get-guests?event_api_id=${eventId}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          "x-luma-api-key": LUMA_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Luma API error for guests ${eventId}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const guests: LumaGuest[] = data.entries || [];

    // Return all guests (filter by approval_status when needed)
    return guests;
  } catch (error) {
    console.error(`Error fetching guests for ${eventId}:`, error);
    return [];
  }
}
