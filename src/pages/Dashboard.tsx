import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFinance, RecurringTransaction } from '@/contexts/FinanceContext';
import { formatDate } from '@/lib/supabase';
import { useCurrency } from '@/contexts/CurrencyContext';
import { DollarSign, Repeat, User2, BarChart3, TrendingUp, Receipt } from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, addDays, parseISO, differenceInDays } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useQuickAdd } from '@/contexts/QuickAddContext';

// Import Refactored Components
import { useFinancialHealth } from '@/hooks/useFinancialHealth';
import { FinancialOverviewCards } from '@/components/dashboard/FinancialOverviewCards';
import { DashboardCharts } from '@/components/dashboard/DashboardCharts';
import { RecentActivityList } from '@/components/dashboard/RecentActivityList';

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

  const { openIncomeModal, openExpenseModal } = useQuickAdd();

  // Destructure data and loading states
  const { data: filteredIncome = [], isLoading: isIncomeLoading } = incomeQuery;
  const { data: filteredExpenses = [], isLoading: isExpensesLoading } = expensesQuery;
  const { data: recurringRules = [], isLoading: isRecurringLoading } = recurringTransactionsQuery;
  const isLoading = isIncomeLoading || isExpensesLoading || isRecurringLoading;

  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month' | 'year'>('month');

  // --- Update Context Filter when Timeframe Changes ---
  useEffect(() => {
    const today = new Date();
    let start: Date;
    let end: Date;

    if (timeframe === 'day') {
      start = new Date(today);
      start.setHours(0, 0, 0, 0);
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
    } else if (timeframe === 'week') {
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
    if (timeframe === 'day') return 1;
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

  // --- Calculate Daily Income Target ---
  const dailyIncomeTarget = useMemo(() => {
    if (numberOfDaysInFilter <= 0) return 0;
    return totalIncome / numberOfDaysInFilter;
  }, [totalIncome, numberOfDaysInFilter]);

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
      if (timeframe === 'day') {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }); // 9 AM
      }
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
      if (timeframe === 'day') {
        const getHourValue = (t: string) => {
          const [time, period] = t.split(' ');
          let [hours] = time.split(':').map(Number);
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          return hours;
        };
        return getHourValue(a) - getHourValue(b);
      }
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


  // Use Custom Hook for Financial Health
  const financialHealth = useFinancialHealth({
    filteredIncome,
    filteredExpenses,
    recentTransactions,
    totalIncome,
    totalExpenses,
    balance,
    formatCurrency
  });

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

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getGreetingEmoji = () => {
    const hour = new Date().getHours();
    if (hour < 5) return '🌌';
    if (hour < 12) return '🌅';
    if (hour < 17) return '☀️';
    if (hour < 20) return '🌆';
    return '🌙';
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 animate-in fade-in duration-1000">
        {/* === Header Section === */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-[1.5rem] bg-muted/50 flex items-center justify-center border border-border/50">
              <span className="text-2xl">{getGreetingEmoji()}</span>
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

        {/* === Refactored Components === */}
        <FinancialOverviewCards
          balance={balance}
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          averageDailyExpenses={averageDailyExpenses}
          dailyIncomeTarget={dailyIncomeTarget}
          formatCurrency={formatCurrency}
          timeframe={timeframe}
          financialHealth={financialHealth}
          isLoading={isLoading}
        />

        {/* === Tabs Switcher (Design Style) === */}
        <div className="flex items-center justify-between bg-muted/30 p-2 rounded-[2rem] border border-border/40">
          <h3 className="ml-4 text-sm font-bold uppercase tracking-widest text-muted-foreground hidden sm:block">Statistics</h3>
          <Tabs value={timeframe} onValueChange={(value) => setTimeframe(value as 'day' | 'week' | 'month' | 'year')} className="w-full sm:w-auto">
            <TabsList className="grid w-full grid-cols-4 bg-transparent p-0 h-auto gap-1">
              <TabsTrigger value="day" className="rounded-3xl font-bold h-10 px-3 sm:px-6 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground focus-visible:ring-0">Today</TabsTrigger>
              <TabsTrigger value="week" className="rounded-3xl font-bold h-10 px-3 sm:px-6 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground focus-visible:ring-0">Weekly</TabsTrigger>
              <TabsTrigger value="month" className="rounded-3xl font-bold h-10 px-3 sm:px-6 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground focus-visible:ring-0">Monthly</TabsTrigger>
              <TabsTrigger value="year" className="rounded-3xl font-bold h-10 px-3 sm:px-6 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground focus-visible:ring-0">Yearly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>


        <div className="flex flex-wrap items-center gap-4 bg-white/50 dark:bg-card/50 p-2 rounded-[2rem] border border-border/40 backdrop-blur-sm -mx-4 px-4 md:mx-0 md:px-2">
          <Button
            onClick={openIncomeModal}
            className="w-[calc(50%-0.5rem)] md:w-auto md:flex-1 h-14 rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500/50"
          >
            <DollarSign className="mr-2 h-5 w-5" strokeWidth={2.5} /> Add Income
          </Button>

          <Button
            onClick={openExpenseModal}
            variant="secondary"
            className="w-[calc(50%-0.5rem)] md:w-auto md:flex-1 h-14 rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:scale-[1.02] transition-all bg-white hover:bg-white/90 text-red-600 shadow-lg shadow-red-500/10 border border-red-100"
          >
            <Receipt className="mr-2 h-5 w-5" strokeWidth={2.5} /> Add Expense
          </Button>

          <Button onClick={() => navigate('/recurring')} variant="outline" className="w-full md:w-auto md:flex-1 h-14 rounded-[1.5rem] font-black text-sm uppercase tracking-widest border-2 border-primary/10 hover:bg-primary/5 transition-all text-muted-foreground bg-transparent">
            <Repeat className="mr-2 h-5 w-5" /> Recurring Rules
          </Button>
        </div>

        {/* === Charts and Activity === */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <DashboardCharts
            chartData={chartData}
            pieChartData={pieChartData}
            isLoading={isLoading}
            totalExpenses={totalExpenses}
            COLORS={COLORS}
          />

          <RecentActivityList
            recentTransactions={recentTransactions}
            upcomingRecurring={upcomingRecurring}
            isLoading={isLoading}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
          />
        </div>
      </div>
      <FloatingActionButton />
    </DashboardLayout>
  );
};

export default Dashboard;
