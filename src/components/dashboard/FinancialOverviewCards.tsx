import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog"
import { useFinancialHealth } from '@/hooks/useFinancialHealth';

interface FinancialOverviewCardsProps {
    balance: number;
    totalIncome: number;
    totalExpenses: number;
    averageDailyExpenses: number;
    dailyIncomeTarget: number;
    formatCurrency: (amount: number) => string;
    timeframe: 'day' | 'week' | 'month' | 'year';
    financialHealth: ReturnType<typeof useFinancialHealth>;
    isLoading: boolean;
}

export const FinancialOverviewCards = ({
    balance,
    totalIncome,
    totalExpenses,
    averageDailyExpenses,
    dailyIncomeTarget,
    formatCurrency,
    timeframe,

    financialHealth,
    isLoading
}: FinancialOverviewCardsProps) => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-12 lg:col-span-8">
                    <div className="hero-card group h-full flex flex-col justify-between min-h-[220px]">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-primary-foreground/90 font-bold uppercase tracking-widest text-xs mb-3 flex items-center gap-2">
                                    <span className="w-8 h-[2px] bg-primary-foreground/50 rounded-full"></span>
                                    {timeframe === 'day' ? 'Balance Today' : timeframe === 'month' ? 'Balance This Month' : timeframe === 'week' ? 'Balance This Week' : 'Balance This Year'}
                                </p>
                                <div className="flex items-baseline gap-1 mb-6">
                                    <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter tabular-nums text-white drop-shadow-xl flex items-center">
                                        {isLoading ? (
                                            <Skeleton className="h-12 w-48 bg-white/20" />
                                        ) : (
                                            <AnimatedNumber
                                                value={balance}
                                                formatFn={(v) => formatCurrency(v).replace(/^(\D+)/, '$1 ')}
                                                className="tabular-nums"
                                            />
                                        )}
                                    </h2>
                                </div>
                            </div>
                            <div className="relative">
                                <div className="absolute -top-4 -right-4 h-32 w-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700" />
                                <Wallet className="h-24 w-24 text-white/40 rotate-12 group-hover:rotate-0 transition-transform duration-700" strokeWidth={1.5} />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-4 mt-auto pt-4 overflow-x-auto no-scrollbar">
                            <div className="px-3 py-2 md:px-5 md:py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-2 md:gap-3">
                                <div className="h-6 w-6 md:h-8 md:w-8 rounded-xl bg-green-400/20 flex items-center justify-center shrink-0">
                                    <ArrowUpRight className="h-3 w-3 md:h-4 md:w-4 text-green-400" />
                                </div>
                                <div className="whitespace-nowrap">
                                    <p className="text-white/50 font-bold uppercase tracking-tighter leading-none mb-1 text-[10px] md:text-xs">Income</p>
                                    {isLoading ? <Skeleton className="h-5 w-24 bg-white/20 mt-1" /> : (
                                        <p className="font-bold text-sm md:text-base leading-none tabular-nums">
                                            <AnimatedNumber
                                                value={totalIncome}
                                                formatFn={(v) => formatCurrency(v).replace(/^(\D+)/, '$1 ')}
                                            />
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="px-3 py-2 md:px-5 md:py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-2 md:gap-3">
                                <div className="h-6 w-6 md:h-8 md:w-8 rounded-xl bg-red-400/20 flex items-center justify-center shrink-0">
                                    <TrendingDown className="h-3 w-3 md:h-4 md:w-4 text-red-400" />
                                </div>
                                <div className="whitespace-nowrap">
                                    <p className="text-white/50 font-bold uppercase tracking-tighter leading-none mb-1 text-[10px] md:text-xs">Expenses</p>
                                    {isLoading ? <Skeleton className="h-5 w-24 bg-white/20 mt-1" /> : (
                                        <p className="font-bold text-sm md:text-base leading-none tabular-nums">
                                            <AnimatedNumber
                                                value={totalExpenses}
                                                formatFn={(v) => formatCurrency(v).replace(/^(\D+)/, '$1 ')}
                                            />
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-12 lg:col-span-4 flex flex-col gap-4 h-full">
                    {/* === Daily Spend Card === */}
                    <div className="clean-card p-5 flex flex-row md:flex-col justify-between items-center md:items-start gap-4 md:gap-2 relative overflow-hidden group flex-1">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />

                        <div className="flex items-center gap-3 z-10">
                            <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <TrendingUp className="h-5 w-5 md:h-6 md:w-6" />
                            </div>
                            <div>
                                <p className="text-xs md:text-sm text-muted-foreground font-medium">Daily Average</p>
                                <h3 className="text-lg md:text-2xl font-black font-display tracking-tight tabular-nums text-foreground flex items-center">
                                    {isLoading ? <Skeleton className="h-8 w-24 bg-muted" /> : (
                                        <AnimatedNumber
                                            value={averageDailyExpenses}
                                            formatFn={formatCurrency}
                                        />
                                    )}
                                </h3>
                            </div>
                        </div>

                        <div className="flex flex-col items-end md:items-start z-10 gap-1">
                            <div className="flex items-center gap-1.5 bg-background/50 px-2 py-1 rounded-lg backdrop-blur-sm">
                                <span className={cn("text-[10px] md:text-base font-black uppercase tracking-widest",
                                    averageDailyExpenses > dailyIncomeTarget ? "text-red-500" : "text-green-500"
                                )}>
                                    {averageDailyExpenses > dailyIncomeTarget ? 'High' : 'Good'}
                                </span>
                            </div>
                            <span className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold hidden md:inline-block">
                                Target: {formatCurrency(dailyIncomeTarget)}/day
                            </span>
                        </div>
                    </div>
                    <Button onClick={() => setOpen(true)} variant="outline" className="w-full rounded-2xl h-12 font-bold border-2 border-primary/10 hover:bg-primary/5 hover:border-primary/20 transition-all">
                        Check Health Score
                    </Button>
                </div>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[460px] max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl rounded-[2.5rem] bg-background [&>button]:text-primary-foreground [&>button]:top-6 [&>button]:right-6 [&>button]:opacity-100 hover:[&>button]:opacity-90">
                    <div className="bg-primary p-10 text-primary-foreground relative">
                        <div className="absolute top-0 right-0 p-8 opacity-20">
                            <TrendingUp className="h-32 w-32 rotate-12" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-70 mb-2">Analysis Result</p>
                            <DialogTitle className="text-4xl font-black tracking-tighter mb-1">Financial Health</DialogTitle>
                            <p className="text-lg font-bold opacity-90">Score: {financialHealth ? financialHealth.score : 0}/100</p>
                        </div>
                    </div>

                    <div className="p-10 space-y-8">
                        <div className="flex h-4 overflow-hidden rounded-full bg-muted shadow-inner relative">
                            <div style={{ width: `${financialHealth ? financialHealth.score : 0}%` }}
                                className={cn(
                                    "transition-all duration-1000 ease-out h-full rounded-full",
                                    financialHealth?.status === 'excellent' ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]' :
                                        financialHealth?.status === 'good' ? 'bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]' :
                                            financialHealth?.status === 'fair' ? 'bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.4)]' :
                                                'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                                )}>
                            </div>
                        </div>

                        <div className="bg-muted/30 p-6 rounded-3xl border border-border/50 text-center">
                            <span className={cn(
                                "text-sm font-black uppercase tracking-[0.3em] mb-3 block",
                                financialHealth?.status === 'excellent' ? 'text-green-600' :
                                    financialHealth?.status === 'good' ? 'text-blue-600' :
                                        financialHealth?.status === 'fair' ? 'text-yellow-600' :
                                            'text-red-600'
                            )}>
                                {financialHealth?.status || 'Analyzing...'}
                            </span>
                            <p className="text-base font-bold text-foreground leading-relaxed italic">
                                "{financialHealth?.message}"
                            </p>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">Smart Advice</h4>
                            <div className="grid grid-cols-1 gap-2">
                                {financialHealth?.advice?.map((item, index) => (
                                    <div key={index} className="flex items-center gap-3 p-4 rounded-2xl bg-secondary/50 border border-border/40 text-sm font-bold text-foreground/80">
                                        <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Button onClick={() => setOpen(false)} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20">
                            Got it, thanks!
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
