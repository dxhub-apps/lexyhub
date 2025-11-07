"use client"

import * as React from "react"
import { Calendar as CalendarIcon, Clock } from "lucide-react"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DateTimePickerProps {
  date?: Date
  setDate: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
}

export function DateTimePicker({
  date,
  setDate,
  placeholder = "Pick a date and time",
  disabled = false,
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(date)
  const [time, setTime] = React.useState<string>(
    date ? format(date, "HH:mm") : "00:00"
  )

  React.useEffect(() => {
    if (date) {
      setSelectedDate(date)
      setTime(format(date, "HH:mm"))
    }
  }, [date])

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) {
      setDate(undefined)
      setSelectedDate(undefined)
      return
    }

    // Preserve the time when selecting a new date
    const [hours, minutes] = time.split(":").map(Number)
    newDate.setHours(hours, minutes)
    setSelectedDate(newDate)
    setDate(newDate)
  }

  const handleTimeChange = (newTime: string) => {
    setTime(newTime)

    if (!selectedDate) return

    const [hours, minutes] = newTime.split(":").map(Number)
    const newDate = new Date(selectedDate)
    newDate.setHours(hours, minutes)
    setSelectedDate(newDate)
    setDate(newDate)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !selectedDate && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? (
            format(selectedDate, "PPP 'at' HH:mm")
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          initialFocus
        />
        <div className="border-t border-border p-3">
          <Label className="text-sm font-medium mb-2 block">
            <Clock className="inline-block h-4 w-4 mr-2" />
            Time
          </Label>
          <Input
            type="time"
            value={time}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="w-full"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
