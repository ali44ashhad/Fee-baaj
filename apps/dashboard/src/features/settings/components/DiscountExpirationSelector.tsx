'use client';

import { useState, useEffect, forwardRef } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Clock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface DiscountExpirationSelectorProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  error?: string;
}

const DiscountExpirationSelector = forwardRef<HTMLDivElement, DiscountExpirationSelectorProps>(
  ({ value, onChange, error }, ref) => {
    const [date, setDate] = useState<Date | undefined>(value);
    const [hours, setHours] = useState<string>(value ? format(value, 'hh') : '12');
    const [minutes, setMinutes] = useState<string>(value ? format(value, 'mm') : '00');
    const [period, setPeriod] = useState<string>(value ? format(value, 'a').toUpperCase() : 'PM');
    const [dateTimeString, setDateTimeString] = useState<string>('');

    // Generate hours options (1-12)
    const hoursOptions = Array.from({ length: 12 }, (_, i) => {
      const hour = i + 1;
      return hour.toString().padStart(2, '0');
    });

    // Generate minutes options (00-55, increments of 5)
    const minutesOptions = Array.from({ length: 12 }, (_, i) => {
      const minute = i * 5;
      return minute.toString().padStart(2, '0');
    });

    useEffect(() => {
      if (value && !date) {
        setDate(value);
        setHours(format(value, 'hh'));
        setMinutes(format(value, 'mm'));
        setPeriod(format(value, 'a').toUpperCase());
      }
    }, [value, date]);

    useEffect(() => {
      if (date) {
        const selectedDate = new Date(date);

        // Set time components
        let hourValue = Number.parseInt(hours);
        if (period === 'PM' && hourValue < 12) hourValue += 12;
        if (period === 'AM' && hourValue === 12) hourValue = 0;

        selectedDate.setHours(hourValue, Number.parseInt(minutes), 0, 0);

        // Format the date and time for display
        setDateTimeString(format(selectedDate, "PPP 'at' h:mm a"));

        // Update the form value
        if (onChange) {
          onChange(selectedDate);
        }
      } else {
        setDateTimeString('');
        if (onChange) {
          onChange(undefined);
        }
      }
    }, [date, hours, minutes, period, onChange]);

    const handleDateChange = (newDate: Date | undefined) => {
      setDate(newDate);
    };

    return (
      <div ref={ref} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="expiration-date">Expiration Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="expiration-date"
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !date && 'text-muted-foreground',
                  error && 'border-destructive',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, 'PPP') : <span>Select date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateChange}
                initialFocus
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Expiration Time</Label>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Select value={hours} onValueChange={setHours} disabled={!date}>
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder="Hour" />
                </SelectTrigger>
                <SelectContent>
                  {hoursOptions.map((hour) => (
                    <SelectItem key={hour} value={hour}>
                      {hour}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-center">:</span>
              <Select value={minutes} onValueChange={setMinutes} disabled={!date}>
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder="Min" />
                </SelectTrigger>
                <SelectContent>
                  {minutesOptions.map((minute) => (
                    <SelectItem key={minute} value={minute}>
                      {minute}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={period} onValueChange={setPeriod} disabled={!date}>
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder="AM/PM" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AM">AM</SelectItem>
                  <SelectItem value="PM">PM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {dateTimeString && (
          <div className="pt-2">
            <p className="text-sm text-muted-foreground">
              Discount will expire on: <span className="font-medium text-foreground">{dateTimeString}</span>
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  },
);

DiscountExpirationSelector.displayName = 'DiscountExpirationSelector';

export default DiscountExpirationSelector;
