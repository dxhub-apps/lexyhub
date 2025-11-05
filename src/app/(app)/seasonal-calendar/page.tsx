"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { MonthCalendar, CalendarEvent } from "@/components/calendar/MonthCalendar";
import { EventDetailsModal } from "@/components/calendar/EventDetailsModal";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Globe, ChevronLeft, ChevronRight } from "lucide-react";

const EVENTS_PER_PAGE = 10;

export default function SeasonalCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(1);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

  const fetchSeasonalPeriods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch ALL seasonal periods from the database
      // The list view needs to show all upcoming and past events
      const response = await fetch("/api/seasonal-periods");

      if (!response.ok) {
        throw new Error("Failed to fetch seasonal periods");
      }
      const data = await response.json();

      console.log("Fetched seasonal periods:", data);
      setEvents(data);
    } catch (err) {
      console.error("Error fetching seasonal periods:", err);
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch all events once when component mounts
    fetchSeasonalPeriods();
  }, [fetchSeasonalPeriods]);

  const handleEventClick = (event: CalendarEvent, date: Date) => {
    setSelectedEvent(event);
    setModalOpen(true);
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    setCurrentPage(1); // Reset to first page when changing months
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    setCurrentPage(1); // Reset to first page when changing months
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setCurrentPage(1); // Reset to first page
  };

  const handleDayClick = (date: Date, dayEvents: CalendarEvent[]) => {
    // Scroll to event list and optionally highlight the events for this day
    const eventListElement = document.getElementById("month-events-list");
    if (eventListElement) {
      eventListElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Filter events for the currently displayed months
  const monthEvents = useMemo(() => {
    return events.filter((event) => {
      const startDate = new Date(event.start_date);
      const endDate = new Date(event.end_date);

      // Check if event overlaps with current month or next month
      const currentMonthStart = new Date(currentYear, currentMonth, 1);
      const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
      const nextMonthStart = new Date(nextYear, nextMonth, 1);
      const nextMonthEnd = new Date(nextYear, nextMonth + 1, 0, 23, 59, 59);

      return (
        (startDate <= currentMonthEnd && endDate >= currentMonthStart) ||
        (startDate <= nextMonthEnd && endDate >= nextMonthStart)
      );
    }).sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  }, [events, currentYear, currentMonth, nextYear, nextMonth]);

  // Pagination for month events
  const totalPages = Math.ceil(monthEvents.length / EVENTS_PER_PAGE);
  const paginatedEvents = useMemo(() => {
    const startIndex = (currentPage - 1) * EVENTS_PER_PAGE;
    const endIndex = startIndex + EVENTS_PER_PAGE;
    return monthEvents.slice(startIndex, endIndex);
  }, [monthEvents, currentPage]);

  // Get all upcoming events sorted chronologically
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingEvents = events
    .filter((event) => new Date(event.end_date) >= today)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const pastEvents = events
    .filter((event) => new Date(event.end_date) < today)
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Commerce Calendar</h1>
        <p className="text-muted-foreground">
          Track seasonal shopping events and trending keywords throughout the year
        </p>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={handlePreviousMonth} variant="outline" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button onClick={handleToday} variant="outline" size="sm">
            Today
          </Button>
          <Button onClick={handleNextMonth} variant="outline" size="sm">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {events.length} seasonal {events.length === 1 ? "event" : "events"}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="p-8 text-center">
          <p className="text-destructive">{error}</p>
          <Button onClick={fetchSeasonalPeriods} variant="outline" className="mt-4">
            Retry
          </Button>
        </Card>
      )}

      {/* Calendar View */}
      {!loading && !error && (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            <MonthCalendar
              year={currentYear}
              month={currentMonth}
              events={events}
              onEventClick={handleEventClick}
              onDayClick={handleDayClick}
            />
            <MonthCalendar
              year={nextYear}
              month={nextMonth}
              events={events}
              onEventClick={handleEventClick}
              onDayClick={handleDayClick}
            />
          </div>

          {/* Empty State */}
          {events.length === 0 && (
            <Card className="p-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Seasonal Events Found</h3>
              <p className="text-muted-foreground mb-4">
                The seasonal_periods table appears to be empty.
              </p>
              <p className="text-sm text-muted-foreground">
                Events should be populated from the database seed data or added by an admin.
              </p>
            </Card>
          )}

          {/* Month Events List with Pagination */}
          {monthEvents.length > 0 && (
            <div id="month-events-list" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">
                  Events for Selected Months
                </h2>
                <div className="text-sm text-muted-foreground">
                  {monthEvents.length} {monthEvents.length === 1 ? "event" : "events"}
                </div>
              </div>

              <div className="grid gap-4">
                {paginatedEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onClick={() => {
                      setSelectedEvent(event);
                      setModalOpen(true);
                    }}
                  />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="sm"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        className="min-w-[2.5rem]"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    variant="outline"
                    size="sm"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Upcoming Events List */}
          {events.length > 0 && (
            <div className="space-y-6">
              {upcomingEvents.length > 0 && (
                <div>
                  <h2 className="text-2xl font-semibold mb-4">Upcoming Events</h2>
                  <div className="grid gap-4">
                    {upcomingEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onClick={() => {
                          setSelectedEvent(event);
                          setModalOpen(true);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {upcomingEvents.length === 0 && pastEvents.length === 0 && (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">
                    No events to display. All seasonal periods may be in the past.
                  </p>
                </Card>
              )}

              {pastEvents.length > 0 && (
                <div>
                  <h2 className="text-2xl font-semibold mb-4">Past Events</h2>
                  <div className="grid gap-4">
                    {pastEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onClick={() => {
                          setSelectedEvent(event);
                          setModalOpen(true);
                        }}
                        isPast
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Event Details Modal */}
      <EventDetailsModal
        event={selectedEvent}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}

interface EventCardProps {
  event: CalendarEvent;
  onClick: () => void;
  isPast?: boolean;
}

function EventCard({ event, onClick, isPast = false }: EventCardProps) {
  const startDate = new Date(event.start_date);
  const endDate = new Date(event.end_date);
  const dateFormat: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  const durationDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  return (
    <Card
      className={`p-6 cursor-pointer transition-all hover:shadow-lg hover:border-accent ${
        isPast ? "opacity-60" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-semibold">{event.name}</h3>
            <Badge
              variant="secondary"
              className={isPast ? "bg-muted" : "bg-accent/20 border-accent"}
            >
              Weight: {event.weight}
            </Badge>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                {startDate.toLocaleDateString("en-US", dateFormat)} -{" "}
                {endDate.toLocaleDateString("en-US", dateFormat)}
              </span>
              <span className="text-xs">({durationDays} days)</span>
            </div>
            {event.country_code && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>{event.country_code}</span>
              </div>
            )}
          </div>
          {event.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {event.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
