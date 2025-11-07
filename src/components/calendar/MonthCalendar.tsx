"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  onDayClick?: (date: Date, events: CalendarEvent[]) => void;
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
  onDayClick,
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
    <TooltipProvider>
      <Card className="overflow-hidden shadow-sm">
        <div className="p-5 border-b bg-gradient-to-br from-muted/40 to-muted/20">
          <h3 className="text-xl font-bold">
            {MONTH_NAMES[month]} {year}
          </h3>
        </div>
        <div className="p-4">
          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-2 mb-3">
            {DAYS_OF_WEEK.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide"
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
                onDayClick={onDayClick}
              />
            ))}
          </div>
        </div>
      </Card>
    </TooltipProvider>
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
  onDayClick?: (date: Date, events: CalendarEvent[]) => void;
}

function CalendarDay({ dayData, isToday, onEventClick, onDayClick }: CalendarDayProps) {
  const hasEvents = dayData.events.length > 0;

  // Check if any events are active today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hasActiveEvents = dayData.events.some((event) => {
    const startDate = new Date(event.start_date);
    const endDate = new Date(event.end_date);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    return startDate <= today && endDate >= today;
  });

  const handleDayClick = () => {
    if (hasEvents) {
      onDayClick?.(dayData.date, dayData.events);
    }
  };

  // Generate tooltip content with event names
  const tooltipContent = hasEvents ? (
    <div className="space-y-1 max-w-xs">
      <div className="text-xs font-semibold mb-1">
        {dayData.events.length} {dayData.events.length === 1 ? "Event" : "Events"}
      </div>
      {dayData.events.slice(0, 5).map((event) => (
        <div key={event.id} className="text-xs flex items-center justify-between gap-2">
          <span className="truncate">{event.name}</span>
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-auto">
            W: {event.weight}
          </Badge>
        </div>
      ))}
      {dayData.events.length > 5 && (
        <div className="text-xs text-muted-foreground">
          +{dayData.events.length - 5} more...
        </div>
      )}
    </div>
  ) : null;

  const dayCell = (
    <div
      onClick={handleDayClick}
      className={cn(
        "min-h-[80px] p-2 rounded-lg border transition-all",
        dayData.isCurrentMonth
          ? "bg-background"
          : "bg-muted/20 text-muted-foreground",
        isToday && "ring-2 ring-primary bg-primary/10 font-bold",
        hasEvents && dayData.isCurrentMonth && hasActiveEvents && "border-success/60 bg-gradient-to-br from-success/15 to-success/5 cursor-pointer hover:from-success/20 hover:to-success/10 hover:border-success hover:shadow-md hover:shadow-success/20",
        hasEvents && dayData.isCurrentMonth && !hasActiveEvents && "border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 hover:border-primary/60 hover:shadow-sm",
        !hasEvents && "hover:bg-muted/30"
      )}
    >
      <div className="flex flex-col h-full">
        <div
          className={cn(
            "text-sm font-semibold mb-1",
            isToday && "text-primary",
            hasEvents && hasActiveEvents && dayData.isCurrentMonth && "text-success",
            hasEvents && !hasActiveEvents && dayData.isCurrentMonth && "text-primary"
          )}
        >
          {dayData.day}
        </div>
        {hasEvents && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex gap-1">
              {dayData.events.slice(0, 3).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "w-2 h-2 rounded-full",
                    hasActiveEvents
                      ? "bg-success border border-success/30 shadow-sm shadow-success/30"
                      : "bg-primary/60 border border-primary/20"
                  )}
                />
              ))}
              {dayData.events.length > 3 && (
                <div className={cn(
                  "text-[10px] font-medium ml-0.5",
                  hasActiveEvents ? "text-success" : "text-primary"
                )}>
                  +{dayData.events.length - 3}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (hasEvents && tooltipContent) {
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          {dayCell}
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="p-3">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    );
  }

  return dayCell;
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
