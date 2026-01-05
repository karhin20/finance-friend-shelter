import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useFinance } from '@/contexts/FinanceContext';

export function GlobalDateFilter({
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  const { filters, setFilters } = useFinance();
  const [localDate, setLocalDate] = useState<DateRange | undefined>(filters.dateRange);
  const [isOpen, setIsOpen] = useState(false);

  // Update local state immediately, context state on closing popover
  const handleSelect = (range: DateRange | undefined) => {
    setLocalDate(range);
    // Update context immediately if preferred:
    // setFilters(prev => ({ ...prev, dateRange: range }));
  };

  // Update context when popover closes to avoid rapid refetches while picking
  const handleOpenChange = (open: boolean) => {
     setIsOpen(open);
     if (!open && localDate !== filters.dateRange) {
        setFilters(prev => ({ ...prev, dateRange: localDate }));
     }
  }

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'w-[260px] justify-start text-left font-normal',
              !localDate && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {localDate?.from ? (
              localDate.to ? (
                <>
                  {format(localDate.from, 'LLL dd, y')} -{' '}
                  {format(localDate.to, 'LLL dd, y')}
                </>
              ) : (
                format(localDate.from, 'LLL dd, y')
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={localDate?.from}
            selected={localDate}
            onSelect={handleSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
} 