"use client";

import { format } from "date-fns";
import { CalendarDays, Clock3 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DepartureDateTimeFieldProps {
  date: string;
  time: string;
  minDate: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}

export function DepartureDateTimeField({
  date,
  time,
  minDate,
  onDateChange,
  onTimeChange,
}: DepartureDateTimeFieldProps) {
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [hour, setHour] = useState(time.slice(0, 2));
  const [minute, setMinute] = useState(time.slice(3, 5));
  const [timeError, setTimeError] = useState(false);
  const selectedDate = date ? new Date(`${date}T12:00:00`) : undefined;
  const validTime =
    /^\d{1,2}$/.test(hour) &&
    /^\d{1,2}$/.test(minute) &&
    Number(hour) <= 23 &&
    Number(minute) <= 59;

  function applyTime() {
    if (!validTime) {
      setTimeError(true);
      return;
    }
    onTimeChange(`${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`);
    setTimeOpen(false);
    setTimeError(false);
  }

  return (
    <div className="min-w-0 rounded-md bg-[#F0F3F7] px-3 py-2 dark:bg-muted">
      <Label className="text-xs text-muted-foreground">Departure</Label>
      <div className="mt-1 flex min-w-0 items-center gap-1">
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                className="min-w-0 flex-1 justify-start gap-2 px-1 font-semibold"
                aria-label="Choose departure date"
              />
            }
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selectedDate
                ? format(selectedDate, "MMM d, yyyy")
                : "Choose date"}
            </span>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(selected) => {
                if (!selected) return;
                onDateChange(format(selected, "yyyy-MM-dd"));
                setDateOpen(false);
              }}
              disabled={
                minDate
                  ? { before: new Date(`${minDate}T00:00:00`) }
                  : undefined
              }
            />
          </PopoverContent>
        </Popover>
        <Popover
          open={timeOpen}
          onOpenChange={(open) => {
            setTimeOpen(open);
            if (open) {
              setHour(time.slice(0, 2));
              setMinute(time.slice(3, 5));
              setTimeError(false);
            }
          }}
        >
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                className="shrink-0 gap-1.5 px-1 font-semibold tabular-nums"
                aria-label="Choose departure time"
              />
            }
          >
            {time || "Time"}
            <Clock3 className="size-3.5 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 gap-3 p-4">
            <p className="text-sm font-medium">Depart after</p>
            <div className="flex items-center gap-2">
              <Input
                aria-label="Hour, 0 to 23"
                inputMode="numeric"
                maxLength={2}
                value={hour}
                onChange={(event) => setHour(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyTime();
                  }
                }}
                className="text-center tabular-nums"
              />
              <span className="text-muted-foreground">:</span>
              <Input
                aria-label="Minute, 0 to 59"
                inputMode="numeric"
                maxLength={2}
                value={minute}
                onChange={(event) => setMinute(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyTime();
                  }
                }}
                className="text-center tabular-nums"
              />
            </div>
            {timeError && (
              <p className="text-xs text-destructive" role="alert">
                Enter a time between 00:00 and 23:59.
              </p>
            )}
            <Button type="button" size="sm" onClick={applyTime}>
              Apply time
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
