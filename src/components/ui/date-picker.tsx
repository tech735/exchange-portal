import * as React from "react";
import { format, isValid, parseISO } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerProps {
  id?: string;
  /** yyyy-MM-dd, or '' for no date (same as a native date input). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Required dates can be changed but not cleared. */
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * shadcn date picker (Popover + Calendar) in place of a native date input,
 * with the calendar icon at the right edge like the Select chevron.
 */
export function DatePicker({ id, value, onChange, placeholder = "Pick a date", required, disabled, className }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const parsed = value ? parseISO(value) : undefined;
  const date = parsed && isValid(parsed) ? parsed : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!date}
          aria-required={required}
          className={cn(
            "h-10 w-full justify-between gap-2 px-3 text-left font-normal data-[empty=true]:text-muted-foreground",
            className
          )}
        >
          <span className="min-w-0 flex-1 truncate">{date ? format(date, "dd MMM yyyy") : placeholder}</span>
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={(day) => {
            if (!day) return;
            onChange(format(day, "yyyy-MM-dd"));
            setOpen(false);
          }}
        />
        {!required && date && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
