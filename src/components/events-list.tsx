"use client";

import { useState } from "react";
import Image from "@/components/optimized-image";
import { Calendar, MapPin, ExternalLink, Users, Euro } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EventMetadata {
  attendance?: number;
  fridgeIncome?: number;
  rentalIncome?: number;
  note?: string;
}

interface Event {
  id: string;
  name: string;
  description?: string;
  startAt: string;
  endAt?: string;
  timezone?: string;
  location?: string;
  url?: string;
  coverImage?: string;
  source: "luma" | "ical";
  metadata: EventMetadata;
}

interface EventsListProps {
  events: Event[];
  isAdmin: boolean;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface InlineNumberEditorProps {
  value?: number;
  onSave: (value: number | undefined) => Promise<void>;
  placeholder?: string;
  prefix?: string;
}

function InlineNumberEditor({ value, onSave, placeholder, prefix }: InlineNumberEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value?.toString() || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (editValue === (value?.toString() || "")) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const numValue = editValue.trim() === "" ? undefined : parseFloat(editValue);
      await onSave(numValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving:", error);
      alert("Failed to save");
      setEditValue(value?.toString() || "");
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(value?.toString() || "");
      setIsEditing(false);
    }
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => {
          setEditValue(value?.toString() || "");
          setIsEditing(true);
        }}
        className="text-sm hover:bg-muted/50 px-2 py-1 rounded transition-colors"
        disabled={isSaving}
      >
        {value !== undefined ? `${prefix || ""}${value}` : placeholder || "—"}
      </button>
    );
  }

  return (
    <input
      type="number"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleSave}
      disabled={isSaving}
      placeholder={placeholder}
      className="text-sm border rounded px-2 py-1 w-20 outline-none focus:ring-2 focus:ring-primary"
      autoFocus
    />
  );
}

interface InlineTextEditorProps {
  value?: string;
  onSave: (value: string | undefined) => Promise<void>;
  placeholder?: string;
}

function InlineTextEditor({ value, onSave, placeholder }: InlineTextEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (editValue === (value || "")) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const trimmedValue = editValue.trim();
      await onSave(trimmedValue === "" ? undefined : trimmedValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving:", error);
      alert("Failed to save");
      setEditValue(value || "");
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(value || "");
      setIsEditing(false);
    }
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => {
          setEditValue(value || "");
          setIsEditing(true);
        }}
        className="text-sm text-muted-foreground hover:bg-muted/50 px-2 py-1 rounded transition-colors italic"
        disabled={isSaving}
      >
        {value || placeholder || "add note"}
      </button>
    );
  }

  return (
    <input
      type="text"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleSave}
      disabled={isSaving}
      placeholder={placeholder}
      className="text-sm border rounded px-2 py-1 w-full outline-none focus:ring-2 focus:ring-primary"
      autoFocus
    />
  );
}

export function EventsList({ events, isAdmin }: EventsListProps) {
  const updateEventMetadata = async (eventId: string, updates: Partial<EventMetadata>) => {
    const response = await fetch(`/api/events/${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error("Failed to update event metadata");
    }

    // Reload the page to show updated data
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const startDate = new Date(event.startAt);
        const endDate = event.endAt ? new Date(event.endAt) : null;

        return (
          <Card key={event.id} className="overflow-hidden">
            <div className="flex flex-col md:flex-row">
              {/* Event Image */}
              {event.coverImage && (
                <div className="relative w-full md:w-64 h-48 md:h-auto flex-shrink-0">
                  <Image
                    src={event.coverImage}
                    alt={event.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}

              {/* Event Details */}
              <div className="flex-1 p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold">{event.name}</h3>
                      {event.source === "luma" && (
                        <Badge variant="secondary" className="text-xs">Luma</Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(event.startAt)}</span>
                        {endDate && (
                          <>
                            <span>-</span>
                            <span>{formatDate(event.endAt!)}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span>{formatTime(event.startAt)}</span>
                        {endDate && (
                          <>
                            <span>-</span>
                            <span>{formatTime(event.endAt!)}</span>
                          </>
                        )}
                      </div>

                      {event.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate max-w-xs">{event.location}</span>
                        </div>
                      )}
                    </div>

                    {event.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    {event.url && (
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        View event details
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Metadata Section (Admin Only) */}
                {isAdmin && (
                  <div className="pt-4 border-t space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Attendance:</span>
                        <InlineNumberEditor
                          value={event.metadata.attendance}
                          onSave={(value) => updateEventMetadata(event.id, { attendance: value })}
                          placeholder="0"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Euro className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Fridge:</span>
                        <InlineNumberEditor
                          value={event.metadata.fridgeIncome}
                          onSave={(value) => updateEventMetadata(event.id, { fridgeIncome: value })}
                          placeholder="0"
                          prefix="€"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Euro className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Rental:</span>
                        <InlineNumberEditor
                          value={event.metadata.rentalIncome}
                          onSave={(value) => updateEventMetadata(event.id, { rentalIncome: value })}
                          placeholder="0"
                          prefix="€"
                        />
                      </div>

                      <div className="flex items-center gap-2 col-span-full">
                        <span className="text-muted-foreground">Note:</span>
                        <InlineTextEditor
                          value={event.metadata.note}
                          onSave={(value) => updateEventMetadata(event.id, { note: value })}
                          placeholder="add note"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
