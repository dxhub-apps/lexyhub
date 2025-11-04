"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CalendarEvent {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  weight: number;
  tags: string[];
  country_code: string | null;
}

interface MonthCalendarProps {
  year: number;
  month: number; // 0-based (0 = January)
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent, date: Date) => void;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function MonthCalendar({
  year,
  month,
  events,
  onEventClick,
}: MonthCalendarProps) {
  // Get the first day of the month
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  // Calculate days from previous month to show
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const prevMonthDays = startingDayOfWeek;

  // Calculate days to show from next month
  const totalCells = Math.ceil((prevMonthDays + daysInMonth) / 7) * 7;
  const nextMonthDays = totalCells - (prevMonthDays + daysInMonth);

  // Build calendar grid
  const calendarDays: Array<{
    date: Date;
    day: number;
    isCurrentMonth: boolean;
    events: CalendarEvent[];
  }> = [];

  // Previous month days
  for (let i = prevMonthDays - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    const date = new Date(year, month - 1, day);
    calendarDays.push({
      date,
      day,
      isCurrentMonth: false,
      events: getEventsForDate(date, events),
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    calendarDays.push({
      date,
      day,
      isCurrentMonth: true,
      events: getEventsForDate(date, events),
    });
  }

  // Next month days
  for (let day = 1; day <= nextMonthDays; day++) {
    const date = new Date(year, month + 1, day);
    calendarDays.push({
      date,
      day,
      isCurrentMonth: false,
      events: getEventsForDate(date, events),
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b bg-muted/30">
        <h3 className="text-lg font-semibold">
          {MONTH_NAMES[month]} {year}
        </h3>
      </div>
      <div className="p-4">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((dayData, index) => (
            <CalendarDay
              key={index}
              dayData={dayData}
              isToday={dayData.date.getTime() === today.getTime()}
              onEventClick={onEventClick}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

interface CalendarDayProps {
  dayData: {
    date: Date;
    day: number;
    isCurrentMonth: boolean;
    events: CalendarEvent[];
  };
  isToday: boolean;
  onEventClick?: (event: CalendarEvent, date: Date) => void;
}

function CalendarDay({ dayData, isToday, onEventClick }: CalendarDayProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const hasEvents = dayData.events.length > 0;
  const visibleEvents = dayData.events.slice(0, 2);
  const hiddenEvents = dayData.events.slice(2);

  const handleEventClick = (event: CalendarEvent) => {
    onEventClick?.(event, dayData.date);
    setPopoverOpen(false);
  };

  return (
    <div
      className={cn(
        "min-h-[100px] p-2 rounded-lg border transition-all",
        dayData.isCurrentMonth
          ? "bg-background"
          : "bg-muted/20 text-muted-foreground",
        isToday && "ring-2 ring-primary bg-primary/5",
        hasEvents && dayData.isCurrentMonth && "border-accent/50 bg-accent/5",
        !hasEvents && "hover:bg-muted/30"
      )}
    >
      <div className="flex flex-col h-full">
        <div
          className={cn(
            "text-sm font-semibold mb-1",
            isToday && "text-primary",
            hasEvents && "text-accent-foreground"
          )}
        >
          {dayData.day}
        </div>
        {hasEvents && (
          <div className="flex-1 space-y-1 overflow-hidden">
            {visibleEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => handleEventClick(event)}
                className="w-full text-left group"
                title={`${event.name} (Weight: ${event.weight})`}
              >
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0.5 h-auto w-full justify-start truncate bg-accent/30 hover:bg-accent/50 border border-accent/60 cursor-pointer transition-all group-hover:scale-[1.02] group-hover:shadow-sm font-medium"
                >
                  {event.name}
                </Badge>
              </button>
            ))}
            {hiddenEvents.length > 0 && (
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto py-0.5 px-1 text-[10px] text-accent-foreground hover:text-accent hover:bg-accent/10 w-full justify-start font-medium"
                  >
                    +{hiddenEvents.length} more event
                    {hiddenEvents.length > 1 ? "s" : ""}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">
                      All events on {dayData.date.toLocaleDateString()}
                    </div>
                    {dayData.events.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => handleEventClick(event)}
                        className="w-full text-left group"
                      >
                        <Badge
                          variant="secondary"
                          className="text-xs px-2 py-1 h-auto w-full justify-start bg-accent/20 hover:bg-accent/40 border-accent cursor-pointer transition-colors"
                        >
                          <span className="truncate">{event.name}</span>
                          <span className="ml-auto text-[10px] opacity-70">
                            W: {event.weight}
                          </span>
                        </Badge>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getEventsForDate(
  date: Date,
  events: CalendarEvent[]
): CalendarEvent[] {
  return events.filter((event) => {
    const startDate = new Date(event.start_date);
    const endDate = new Date(event.end_date);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    return date >= startDate && date <= endDate;
  });
}
