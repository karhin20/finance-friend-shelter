import { Button } from '@/components/ui/button';
import { ArrowUpRight, TrendingDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { RecurringTransaction } from '@/contexts/FinanceContext';
import { Income, Expense } from '@/lib/supabase';

interface RecentActivityListProps {
    recentTransactions: ((Income | Expense) & { type: 'income' | 'expense' })[];
    upcomingRecurring: {
        next7Days: RecurringTransaction[];
        thisMonth: RecurringTransaction[];
        upcomingThisMonthTotal: number;
    };
    isLoading: boolean;
    formatCurrency: (amount: number) => string;
    formatDate: (date: string) => string;
}

export const RecentActivityList = ({
    recentTransactions,
    upcomingRecurring,
    isLoading,
    formatCurrency,
    formatDate,
}: RecentActivityListProps) => {
    const navigate = useNavigate();

    return (
        <div className="lg:col-span-12 xl:col-span-5 space-y-6">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-xl font-black tracking-tight font-display">Recent Activity</h3>
                <Button variant="link" className="text-primary font-bold px-0 h-auto" onClick={() => navigate('/expenses')}>View List</Button>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-hidden pr-1">
                {isLoading ? (
                    [...Array(5)].map((_, i) => <div key={i} className="h-20 w-full bg-muted/20 animate-pulse rounded-[2rem]" />)
                ) : recentTransactions.length > 0 ? (
                    recentTransactions.map((tx) => (
                        <div key={`${tx.id}-${tx.date}`} className="expense-item group cursor-pointer" onClick={() => navigate(tx.type === 'income' ? '/income' : '/expenses')}>
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "h-8 w-8 shrink-0 flex items-center justify-center rounded-full bg-background/50 backdrop-blur-sm border border-border/10",
                                    tx.type === 'income' ? "text-green-600" : "text-red-500"
                                )}>
                                    {tx.type === 'income' ? <ArrowUpRight className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-foreground text-xs leading-none truncate">{tx.category || (tx.type === 'income' ? 'Income' : 'Expense')}</h4>
                                    <p className="text-[10px] font-bold text-muted-foreground opacity-70 mt-1">{formatDate(tx.date)}</p>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <p className={cn(
                                    "font-black tracking-tight text-sm md:text-base tabular-nums",
                                    tx.type === 'income' ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"
                                )}>
                                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-10 opacity-50 bg-muted/10 rounded-[2.5rem] border-2 border-dashed border-border/50">
                        <p className="font-bold">No activity recorded</p>
                    </div>
                )}
            </div>

            {/* Upcoming indicator */}
            {upcomingRecurring.next7Days.length > 0 && (
                <div className="p-6 rounded-[2rem] bg-secondary/50 border border-primary/20 flex items-center justify-between group cursor-pointer hover:bg-secondary transition-colors" onClick={() => navigate('/recurring')}>
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-foreground leading-none mb-1">Upcoming Payments</h4>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{upcomingRecurring.next7Days.length} Scheduled for next 7 days</p>
                        </div>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            )}
        </div>
    );
};
