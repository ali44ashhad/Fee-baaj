import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from './label';

interface DatePickerProps {
  label?: string;
  value?: Date;
  onChange?: (d?: Date) => void;
  error?: string;
  id?: string;
}

export function DatePicker({ label, onChange, value, error, id }: DatePickerProps) {
  return (
    <div className="space-y-2">
      {label && <Label className="block">{label}</Label>}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={'outline'}
            className={cn('w-[280px] justify-start text-left font-normal', !value && 'text-muted-foreground')}
          >
            <CalendarIcon />
            {value ? format(value, 'PPP') : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus />
        </PopoverContent>
      </Popover>
      {error && <div className="text-red-500 text-sm">{error}</div>}
    </div>
  );
}
