import { useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useCurrency, CURRENCIES } from '@/contexts/CurrencyContext';
import { cn } from '@/lib/utils';

export function CurrencySelector() {
    const { currency, setCurrency } = useCurrency();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2 rounded-xl border-border/40 bg-muted/20 hover:bg-muted/40 font-semibold"
                >
                    <Globe className="h-4 w-4" />
                    <span className="hidden sm:inline">{currency.code}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Select Currency
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {CURRENCIES.map((curr) => (
                    <DropdownMenuItem
                        key={curr.code}
                        onClick={() => setCurrency(curr)}
                        className={cn(
                            "cursor-pointer rounded-lg transition-colors",
                            currency.code === curr.code && "bg-primary/10 text-primary font-semibold"
                        )}
                    >
                        <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col">
                                <span className="font-medium">{curr.country}</span>
                                <span className="text-xs text-muted-foreground">
                                    {curr.symbol} {curr.code}
                                </span>
                            </div>
                            {currency.code === curr.code && (
                                <Check className="h-4 w-4 text-primary" strokeWidth={2.5} />
                            )}
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
