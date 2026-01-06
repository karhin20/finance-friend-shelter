
import { useState } from 'react';
import { Plus, Wallet, Receipt, Repeat, PiggyBank } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

export function FloatingActionButton() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);

    return (
        <div className="fixed bottom-20 right-4 z-50 md:hidden">
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        size="icon"
                        className="h-14 w-14 rounded-full shadow-premium-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 hover:scale-105 active:scale-95"
                    >
                        <Plus className={`h-8 w-8 transition-transform duration-300 ${open ? 'rotate-45' : ''}`} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="mb-2 w-48 rounded-xl p-2 shadow-2xl border-border/50 bg-background/95 backdrop-blur">
                    <DropdownMenuItem onClick={() => navigate('/income')} className="p-3 mb-1 cursor-pointer rounded-lg focus:bg-primary/10 focus:text-primary">
                        <Wallet className="mr-2 h-4 w-4" />
                        <span className="font-medium">Add Income</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/expenses')} className="p-3 mb-1 cursor-pointer rounded-lg focus:bg-primary/10 focus:text-primary">
                        <Receipt className="mr-2 h-4 w-4" />
                        <span className="font-medium">Add Expense</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/recurring')} className="p-3 mb-1 cursor-pointer rounded-lg focus:bg-primary/10 focus:text-primary">
                        <Repeat className="mr-2 h-4 w-4" />
                        <span className="font-medium">Recurring</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/savings')} className="p-3 cursor-pointer rounded-lg focus:bg-primary/10 focus:text-primary">
                        <PiggyBank className="mr-2 h-4 w-4" />
                        <span className="font-medium">Add Savings</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
