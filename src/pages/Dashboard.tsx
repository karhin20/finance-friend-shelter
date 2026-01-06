import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFinance, RecurringTransaction } from '@/contexts/FinanceContext';
import { Income, Expense, formatDate } from '@/lib/supabase';
import { useCurrency } from '@/contexts/CurrencyContext';
import { BarChart, PieChart, Pie, Bar, XAxis, YAxis, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, TrendingUp, TrendingDown, DollarSign, Plus, ExternalLink, Calculator, Repeat, Moon, Sun, Clock, User2, BarChart3, PieChart as PieChartIcon, Wallet, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, addDays, isAfter, parseISO, differenceInDays } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();
  const {
    incomeQuery,
    expensesQuery,
    filters,
    setFilters,
    recurringTransactionsQuery
  } = useFinance();

  // Destructure data and loading states
  const { data: filteredIncome = [], isLoading: isIncomeLoading } = incomeQuery;
  const { data: filteredExpenses = [], isLoading: isExpensesLoading } = expensesQuery;
  const { data: recurringRules = [], isLoading: isRecurringLoading } = recurringTransactionsQuery;
  const isLoading = isIncomeLoading || isExpensesLoading || isRecurringLoading;

  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('month');

  // --- Update Context Filter when Timeframe Changes ---
  useEffect(() => {
    const today = new Date();
    let start: Date;
    let end: Date;

    if (timeframe === 'week') {
      start = startOfWeek(today, { weekStartsOn: 0 });
      end = endOfWeek(today, { weekStartsOn: 0 });
    } else if (timeframe === 'month') {
      start = startOfMonth(today);
      end = endOfMonth(today);
    } else { // year
      start = startOfYear(today);
      end = endOfYear(today);
    }
    end.setHours(23, 59, 59, 999); // Include full end day

    // Update the context filter only if it's different
    if (filters.dateRange?.from?.getTime() !== start.getTime() || filters.dateRange?.to?.getTime() !== end.getTime()) {
      setFilters(prev => ({ ...prev, dateRange: { from: start, to: end } }));
    }
  }, [timeframe, setFilters, filters.dateRange]); // Re-run when timeframe changes

  // --- Calculations (Now use filteredIncome/filteredExpenses directly from context) ---
  const totalIncome = filteredIncome.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  const balance = totalIncome - totalExpenses;

  // --- Calculate Number of Days in Filter Range ---
  const numberOfDaysInFilter = useMemo(() => {
    if (filters.dateRange?.from && filters.dateRange?.to) {
      // Ensure dates are valid Date objects
      const startDate = filters.dateRange.from instanceof Date ? filters.dateRange.from : new Date(filters.dateRange.from);
      const endDate = filters.dateRange.to instanceof Date ? filters.dateRange.to : new Date(filters.dateRange.to);

      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        // differenceInDays is exclusive of the end date, add 1 for inclusive count
        return differenceInDays(endDate, startDate) + 1;
      }
    }
    // Default or fallback if dates are invalid/not set (e.g., for 'month')
    const today = new Date();
    if (timeframe === 'week') return 7;
    if (timeframe === 'month') return differenceInDays(endOfMonth(today), startOfMonth(today)) + 1;
    if (timeframe === 'year') return differenceInDays(endOfYear(today), startOfYear(today)) + 1;
    return 1; // Fallback to 1 to avoid division by zero
  }, [filters.dateRange, timeframe]); // Recalculate when filter range or timeframe changes

  // --- Calculate Average Daily Expenses ---
  const averageDailyExpenses = useMemo(() => {
    if (numberOfDaysInFilter <= 0) return 0; // Avoid division by zero
    return totalExpenses / numberOfDaysInFilter;
  }, [totalExpenses, numberOfDaysInFilter]);

  // Prepare data for expense categories pie chart (using filteredExpenses)
  const categoryData = filteredExpenses.reduce((acc: { [key: string]: number }, expense) => {
    if (!acc[expense.category]) acc[expense.category] = 0;
    acc[expense.category] += expense.amount;
    return acc;
  }, {});

  const pieChartData = Object.keys(categoryData).map(category => ({
    name: category,
    value: categoryData[category]
  })).sort((a, b) => b.value - a.value); // Sort for consistent colors

  // Prepare data for income vs expenses bar chart (using filteredIncome, filteredExpenses)
  const groupedData = useMemo(() => {
    const incomeMap: Record<string, number> = {};
    const expenseMap: Record<string, number> = {};

    // Format based on timeframe (same logic as before)
    const getDateKey = (dateStr: string) => {
      const date = new Date(dateStr);
      if (timeframe === 'week') return date.toLocaleString('default', { weekday: 'short' }); // Mon, Tue etc.
      if (timeframe === 'month') return date.getDate().toString(); // 1, 2, 3 etc.
      if (timeframe === 'year') return date.toLocaleString('default', { month: 'short' }); // Jan, Feb etc.
      return '';
    };

    // Use filtered data
    filteredIncome.forEach(item => {
      const key = getDateKey(item.date);
      incomeMap[key] = (incomeMap[key] || 0) + item.amount;
    });
    filteredExpenses.forEach(item => {
      const key = getDateKey(item.date);
      expenseMap[key] = (expenseMap[key] || 0) + item.amount;
    });

    const keys = Array.from(new Set([...Object.keys(incomeMap), ...Object.keys(expenseMap)]));

    // Sort keys appropriately (same logic as before)
    const dayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    keys.sort((a, b) => {
      if (timeframe === 'week') return dayOrder.indexOf(a) - dayOrder.indexOf(b);
      if (timeframe === 'month') return parseInt(a) - parseInt(b);
      if (timeframe === 'year') return monthOrder.indexOf(a) - monthOrder.indexOf(b);
      return 0;
    });

    return keys.map(key => ({
      name: key,
      Income: incomeMap[key] || 0,
      Expenses: expenseMap[key] || 0
    }));
  }, [filteredIncome, filteredExpenses, timeframe]);


  const chartData = groupedData;

  const COLORS = ['#0A84FF', '#00C49F', '#FF5A5F', '#FFBB28', '#AF52DE', '#FF9500', '#5856D6'];

  // Recent transactions (using *all* data from context, sorted, limited)
  const { data: allIncomeForRecent = [] } = incomeQuery;
  const { data: allExpensesForRecent = [] } = expensesQuery;
  const recentTransactions = useMemo(() => {
    try {
      return [...allIncomeForRecent.map(i => ({ ...i, type: 'income' as const })),
      ...allExpensesForRecent.map(e => ({ ...e, type: 'expense' as const }))]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5); // Show 5 most recent overall
    } catch (error) {
      console.error('Error processing recent transactions:', error);
      return [];
    }
  }, [allIncomeForRecent, allExpensesForRecent]); // Depend on the full data from context

  // Financial Health calculations (use filtered data for timeframe-specific metrics)
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  const currentMonthIncome = filteredIncome // Use filtered data for consistency within view
    .filter(t => isWithinInterval(new Date(t.date), { start: currentMonthStart, end: currentMonthEnd }))
    .reduce((sum, t) => sum + t.amount, 0);

  const currentMonthExpenses = filteredExpenses // Use filtered data for consistency within view
    .filter(t => isWithinInterval(new Date(t.date), { start: currentMonthStart, end: currentMonthEnd }))
    .reduce((sum, t) => sum + t.amount, 0);

  const currentMonthSavings = currentMonthIncome - currentMonthExpenses;

  const savingsRatio = currentMonthIncome > 0 ? (currentMonthSavings / currentMonthIncome) * 100 : 0;

  const categories = filteredExpenses.map(e => e.category); // Use filtered expenses for category diversity within timeframe
  const uniqueCategories = new Set(categories).size;
  const categoryDiversity = uniqueCategories > 0 ? Math.min(uniqueCategories / 5, 1) * 100 : 0;

  // Consistency calculation remains based on recent transactions (which use all data)
  const oldestTransactionDate = useMemo(() => {
    if (recentTransactions.length === 0) return new Date();
    try {
      return new Date(Math.min(...recentTransactions.map(t => new Date(t.date).getTime())));
    } catch { return new Date(); }
  }, [recentTransactions]);

  const daysSinceFirst = Math.max(1, Math.floor((new Date().getTime() - oldestTransactionDate.getTime()) / (1000 * 60 * 60 * 24)));
  const avgTransactionsPerDay = recentTransactions.length / daysSinceFirst;
  const consistencyScore = Math.min(avgTransactionsPerDay * 10, 100);

  const getFinancialHealthStatus = useCallback(() => {
    // Recalculate health score with more balanced weights
    // New scoring system:
    // - Savings Rate: 40% (important but not overwhelming)
    // - Spending Control: 30% (whether you're living within means)
    // - Consistency: 20% (regular tracking)
    // - Category Diversity: 10% (nice to have for insights)

    // Calculate spending control score (0-100)
    // Rewards positive balance, penalizes overspending
    let spendingControlScore = 0;
    if (totalIncome > 0) {
      const balanceRatio = balance / totalIncome;
      if (balanceRatio >= 0.3) {
        spendingControlScore = 100; // Saving 30%+ is excellent
      } else if (balanceRatio >= 0) {
        spendingControlScore = (balanceRatio / 0.3) * 100; // Scale 0-30% savings to 0-100 score
      } else {
        // Penalize overspending more heavily
        spendingControlScore = Math.max(0, 50 + (balanceRatio * 100)); // -50% overspending = 0 score
      }
    }

    const weights = { savings: 0.40, spendingControl: 0.30, consistency: 0.20, diversity: 0.10 };
    const healthScore = (savingsRatio * weights.savings) +
      (spendingControlScore * weights.spendingControl) +
      (consistencyScore * weights.consistency) +
      (categoryDiversity * weights.diversity);

    let status = 'poor';
    let message = "Consider reviewing your financial habits.";

    if (healthScore >= 75) {
      status = 'excellent';
      message = "Excellent! You're saving well and managing your finances effectively.";
    } else if (healthScore >= 55) {
      status = 'good';
      message = "Good! You're on the right track with your financial management.";
    } else if (healthScore >= 35) {
      status = 'fair';
      message = "You're making progress, but there's room for improvement.";
    }

    // Provide tailored, actionable advice based on financial behavior
    const advice: string[] = [];

    // CRITICAL: Spending exceeds income
    if (totalExpenses > totalIncome) {
      const deficit = totalExpenses - totalIncome;
      advice.push(`🚨 Critical: You're spending ${formatCurrency(deficit)} more than you earn. Cut non-essential expenses immediately.`);
    }

    // URGENT: Negative savings this month
    if (currentMonthSavings < 0 && totalExpenses <= totalIncome) {
      advice.push(`⚠️ This month's expenses (${formatCurrency(currentMonthExpenses)}) exceed income (${formatCurrency(currentMonthIncome)}). Review and adjust spending.`);
    }

    // Savings rate analysis with specific targets
    if (savingsRatio < 10 && totalIncome > 0) {
      advice.push(`💰 Your savings rate is ${Math.round(savingsRatio)}%. Start with a goal to save at least 10-15% monthly, then work toward 20%.`);
    } else if (savingsRatio < 20 && savingsRatio >= 10) {
      advice.push(`💰 Good start! You're saving ${Math.round(savingsRatio)}%. Try increasing to 20% by reducing one recurring expense.`);
    } else if (savingsRatio >= 20 && savingsRatio < 30) {
      advice.push(`🎯 Excellent! You're saving ${Math.round(savingsRatio)}%. Consider increasing to 30% if possible for faster wealth building.`);
    }

    // Category diversity insights
    if (uniqueCategories < 3 && filteredExpenses.length > 0) {
      advice.push(`📊 You're only tracking ${uniqueCategories} expense ${uniqueCategories === 1 ? 'category' : 'categories'}. Break down expenses (Food, Transport, Bills, Entertainment, etc.) for better insights.`);
    }


    // Top spending category analysis (calculate inline to avoid dependency issues)
    const localTopExpenses = filteredExpenses.reduce((acc, item) => {
      const key = item.category || 'Uncategorized';
      acc[key] = (acc[key] || 0) + item.amount;
      return acc;
    }, {} as Record<string, number>);
    const topExpensesArray = Object.entries(localTopExpenses)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    if (topExpensesArray.length > 0 && totalExpenses > 0) {
      const topCategory = topExpensesArray[0];
      const topPercentage = (topCategory.amount / totalExpenses) * 100;
      if (topPercentage > 40) {
        advice.push(`📈 ${topCategory.name} accounts for ${Math.round(topPercentage)}% of spending (${formatCurrency(topCategory.amount)}). Look for ways to reduce this category.`);
      }
    }

    // Transaction logging consistency
    if (avgTransactionsPerDay < 0.3 && filteredExpenses.length < 10) {
      advice.push(`✍️ Log transactions daily for accurate tracking. Even small purchases add up and impact your budget.`);
    }

    // Emergency fund recommendation (if savings are positive)
    if (savingsRatio > 10 && currentMonthSavings > 0) {
      const emergencyFundGoal = currentMonthExpenses * 3; // 3 months of expenses
      if (currentMonthSavings < emergencyFundGoal) {
        advice.push(`🛡️ Build an emergency fund covering 3-6 months of expenses (Target: ${formatCurrency(emergencyFundGoal)}). Save ${formatCurrency((emergencyFundGoal / 12))} monthly.`);
      }
    }

    // Income growth suggestions
    if (totalIncome < totalExpenses * 1.2 && totalIncome > 0) {
      advice.push(`📈 Your income should ideally be 20%+ above expenses. Consider side hustles or additional income streams.`);
    }

    // Positive reinforcement for good behavior
    if (savingsRatio >= 30) {
      advice.push(`🌟 Outstanding! You're saving ${Math.round(savingsRatio)}%. You're building wealth effectively. Keep it up!`);
    }

    // Budget balance check
    const budgetHealthRatio = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;
    if (budgetHealthRatio > 50 && balance > 0) {
      advice.push(`✅ You're saving over 50% of your income! Consider investing excess savings for long-term growth.`);
    }

    // Default positive message if everything is great
    if (advice.length === 0 || (healthScore >= 70 && advice.length < 2)) {
      advice.push(`🎉 Great financial management! Your habits are strong. Continue tracking and growing your wealth.`);
    }

    return {
      status,
      message,
      score: Math.round(healthScore),
      advice: advice.slice(0, 5) // Limit to top 5 most relevant suggestions
    };
  }, [savingsRatio, categoryDiversity, consistencyScore, totalIncome, totalExpenses, currentMonthSavings, currentMonthIncome, currentMonthExpenses, filteredExpenses, formatCurrency, avgTransactionsPerDay, balance, uniqueCategories]); // Dependencies for health calculation

  const financialHealth = useMemo(getFinancialHealthStatus, [getFinancialHealthStatus]);

  // Top sources/categories (using filtered data)
  const topIncomeSources = useMemo(() => {
    // Group and sum filtered income
    const grouped = filteredIncome.reduce((acc, item) => {
      const key = item.description || 'Unspecified Income';
      acc[key] = (acc[key] || 0) + item.amount;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(grouped).map(([description, amount]) => ({ description, amount })).sort((a, b) => b.amount - a.amount);
  }, [filteredIncome]);

  const topExpenseCategories = useMemo(() => {
    // Group and sum filtered expenses by category
    const grouped = filteredExpenses.reduce((acc, item) => {
      const key = item.category || 'Uncategorized';
      acc[key] = (acc[key] || 0) + item.amount;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(grouped).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  // --- Process Recurring Data for Dashboard ---
  const upcomingRecurring = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const nextWeekEnd = addDays(today, 7); // End of 7 days from now
    const currentMonthEnd = endOfMonth(today);

    const activeRules = recurringRules.filter(rule => rule.is_active);

    const next7Days: RecurringTransaction[] = [];
    const thisMonth: RecurringTransaction[] = [];

    activeRules.forEach(rule => {
      try {
        const nextDueDate = parseISO(rule.next_due_date); // Parse the date string
        // Check if due date is valid and not in the past relative to today's start
        if (!isNaN(nextDueDate.getTime()) && differenceInDays(nextDueDate, today) >= 0) {
          // Check if within the next 7 days
          if (isWithinInterval(nextDueDate, { start: today, end: nextWeekEnd })) {
            next7Days.push(rule);
          }
          // Check if within the current month (from today onwards)
          if (isWithinInterval(nextDueDate, { start: today, end: currentMonthEnd })) {
            thisMonth.push(rule);
          }
        }
      } catch (e) {
        console.error("Error parsing date for recurring rule:", rule.id, rule.next_due_date, e);
      }
    });

    // Sort by date
    next7Days.sort((a, b) => parseISO(a.next_due_date).getTime() - parseISO(b.next_due_date).getTime());
    thisMonth.sort((a, b) => parseISO(a.next_due_date).getTime() - parseISO(b.next_due_date).getTime());

    const upcomingThisMonthTotal = thisMonth.reduce((acc, rule) => {
      return acc + (rule.type === 'expense' ? rule.amount : -rule.amount); // Sum expenses, subtract income
    }, 0);

    return {
      next7Days,
      thisMonth,
      upcomingThisMonthTotal, // Net total (expenses - income)
    };
  }, [recurringRules]);

  // --- JSX ---
  const [open, setOpen] = useState(false);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 animate-in fade-in duration-1000">
        {/* === Header Section === */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-[1.5rem] bg-muted/50 flex items-center justify-center border border-border/50">
              <span className="text-2xl">👋</span>
            </div>
            <div>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest leading-none mb-0 flex items-center gap-2">
                {getGreeting()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="hidden md:flex h-12 w-12 rounded-2xl border-none bg-muted/30" onClick={() => navigate('/settings')}>
              <User2 className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" className="hidden md:flex h-12 w-12 rounded-2xl border-none bg-muted/30" onClick={() => navigate('/reports')}>
              <BarChart3 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Mobile FAB */}
        <FloatingActionButton />

        {/* === Onboarding Alert === */}
        {!isLoading && filteredIncome.length === 0 && filteredExpenses.length === 0 && (
          <Alert variant="default" className="bg-primary/5 border-primary/20 text-primary shadow-premium rounded-[2rem] p-8 border-dashed">
            <div className="flex items-center gap-6">
              <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center shrink-0">
                <TrendingUp className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <AlertTitle className="text-xl font-bold tracking-tight">Ready to start tracking?</AlertTitle>
                <AlertDescription className="text-primary/70 font-semibold">
                  Record your first transaction to see your financial growth insights.
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        {/* === Hero Section (The Designer Card) === */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-12 lg:col-span-8">
            <div className="hero-card group h-full flex flex-col justify-between min-h-[220px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-primary-foreground/90 font-bold uppercase tracking-widest text-xs mb-3 flex items-center gap-2">
                    <span className="w-8 h-[2px] bg-primary-foreground/50 rounded-full"></span>
                    {timeframe === 'month' ? 'Net Balance This Month' : timeframe === 'week' ? 'Net Balance This Week' : 'Net Balance This Year'}
                  </p>
                  <div className="flex items-baseline gap-1 mb-6">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white drop-shadow-xl">
                      {formatCurrency(balance).replace(/^(\D+)/, '$1 ')}
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
                    <p className="font-bold text-sm md:text-base leading-none">{formatCurrency(totalIncome).replace(/^(\D+)/, '$1 ')}</p>
                  </div>
                </div>
                <div className="px-3 py-2 md:px-5 md:py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-2 md:gap-3">
                  <div className="h-6 w-6 md:h-8 md:w-8 rounded-xl bg-red-400/20 flex items-center justify-center shrink-0">
                    <TrendingDown className="h-3 w-3 md:h-4 md:w-4 text-red-400" />
                  </div>
                  <div className="whitespace-nowrap">
                    <p className="text-white/50 font-bold uppercase tracking-tighter leading-none mb-1 text-[10px] md:text-xs">Expenses</p>
                    <p className="font-bold text-sm md:text-base leading-none">{formatCurrency(totalExpenses).replace(/^(\D+)/, '$1 ')}</p>
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
                  <h3 className="text-lg md:text-2xl font-black font-display tracking-tight text-foreground">
                    {formatCurrency(averageDailyExpenses)}
                  </h3>
                </div>
              </div>

              <div className="flex flex-col items-end md:items-start z-10 gap-1">
                <div className="flex items-center gap-1.5 bg-background/50 px-2 py-1 rounded-lg backdrop-blur-sm">
                  <span className={cn("text-[10px] md:text-base font-black uppercase tracking-widest",
                    averageDailyExpenses > (totalIncome / 30) ? "text-red-500" : "text-green-500"
                  )}>
                    {averageDailyExpenses > (totalIncome / 30) ? 'High' : 'Good'}
                  </span>
                </div>
                <span className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold hidden md:inline-block">
                  Target: {formatCurrency(totalIncome / 30)}/day
                </span>
              </div>
            </div>
            <Button onClick={() => setOpen(true)} variant="outline" className="w-full rounded-2xl h-12 font-bold border-2 border-primary/10 hover:bg-primary/5 hover:border-primary/20 transition-all">
              Check Health Score
            </Button>
          </div>
        </div>

        {/* === Tabs Switcher (Design Style) === */}
        <div className="flex items-center justify-between bg-muted/30 p-2 rounded-[2rem] border border-border/40">
          <h3 className="ml-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">Statistics</h3>
          <Tabs value={timeframe} onValueChange={(value) => setTimeframe(value as 'week' | 'month' | 'year')} className="w-full sm:w-auto">
            <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 h-auto gap-1">
              <TabsTrigger value="week" className="rounded-3xl font-bold h-10 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground focus-visible:ring-0">Weekly</TabsTrigger>
              <TabsTrigger value="month" className="rounded-3xl font-bold h-10 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground focus-visible:ring-0">Monthly</TabsTrigger>
              <TabsTrigger value="year" className="rounded-3xl font-bold h-10 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground focus-visible:ring-0">Yearly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>



        {/* === Quick Action Toolbar === */}
        <div className="hidden md:flex flex-wrap items-center gap-4 bg-white/50 dark:bg-card/50 p-2 rounded-[2rem] border border-border/40 backdrop-blur-sm">
          <Button onClick={() => navigate('/income')} className="flex-1 min-w-[140px] h-14 rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
            <DollarSign className="mr-2 h-5 w-5" strokeWidth={2.5} /> Add Income
          </Button>
          <Button onClick={() => navigate('/expenses')} variant="secondary" className="flex-1 min-w-[140px] h-14 rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:scale-[1.02] transition-all">
            <Receipt className="mr-2 h-5 w-5" strokeWidth={2.5} /> Add Expense
          </Button>
          <Button onClick={() => navigate('/recurring')} variant="outline" className="flex-1 min-w-[140px] h-14 rounded-[1.5rem] font-black text-sm uppercase tracking-widest border-2 border-primary/10 hover:bg-primary/5 transition-all">
            <Repeat className="mr-2 h-5 w-5" /> Recurring
          </Button>
        </div>

        {/* === Charts Section === */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-12 xl:col-span-7 space-y-8">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-black tracking-tight font-display">Financial Trends</h3>
              <Button variant="ghost" size="sm" className="font-bold text-primary hover:bg-primary/5 rounded-xl" onClick={() => navigate('/reports')}>
                Detailed Reports <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-[2.5rem] border-none shadow-premium bg-card overflow-hidden group">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Cash Flow</CardTitle>
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:rotate-12 transition-transform">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="h-[280px] pt-4">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center animate-pulse bg-muted/20 rounded-3xl" />
                  ) : chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={false} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar name="Income" dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={16} />
                        <Bar name="Expenses" dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                      <p className="text-sm font-bold">Waiting for data...</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-[2.5rem] border-border/30 shadow-premium overflow-hidden group hover:-translate-y-1 transition-all duration-500">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Spending</CardTitle>
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:rotate-12 transition-transform">
                      <PieChartIcon className="h-4 w-4" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="h-[280px] pt-4">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center animate-pulse bg-muted/20 rounded-3xl" />
                  ) : pieChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={2} stroke="hsl(var(--card))" />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                      <p className="text-sm font-bold">No expenses yet</p>
                    </div>
                  )}
                </CardContent>
                {/* Custom Legend */}
                {pieChartData.length > 0 && (
                  <div className="px-6 pb-6 pt-2">
                    <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto pr-1 no-scrollbar">
                      {pieChartData.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="truncate">{entry.name}</span>
                          <span className="ml-auto font-bold text-foreground">{((entry.value / totalExpenses) * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* === Recent Activity List (Design Style) === */}
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
                        "font-black tracking-tight text-sm md:text-base",
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
        </div>

        {/* Floating Health Dialog at the bottom if needed - oh wait it's already in the Health Score button */}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px] max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl rounded-[2.5rem] bg-background [&>button]:text-primary-foreground [&>button]:top-6 [&>button]:right-6 [&>button]:opacity-100 hover:[&>button]:opacity-90">
          <div className="bg-primary p-10 text-primary-foreground relative">
            <div className="absolute top-0 right-0 p-8 opacity-20">
              <TrendingUp className="h-32 w-32 rotate-12" />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-70 mb-2">Analysis Result</p>
              <h2 className="text-4xl font-black tracking-tighter mb-1">Financial Health</h2>
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
    </DashboardLayout >
  );
};

export default Dashboard;
