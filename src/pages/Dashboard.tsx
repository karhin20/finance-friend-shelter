import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFinance, RecurringTransaction } from '@/contexts/FinanceContext';
import { Income, Expense, formatCurrency, formatDate } from '@/lib/supabase';
import { BarChart, PieChart, Pie, Bar, XAxis, YAxis, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, TrendingUp, TrendingDown, DollarSign, Plus, ExternalLink, Calculator, Repeat, Moon, Sun, Clock } from 'lucide-react';
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
  const navigate = useNavigate();
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
     // Recalculate health score using potentially updated metrics
    const weights = { savings: 0.5, diversity: 0.3, consistency: 0.2 };
     const healthScore = (savingsRatio * weights.savings) + (categoryDiversity * weights.diversity) + (consistencyScore * weights.consistency);

    let status = 'poor';
    let message = "Consider reviewing your financial habits.";
    
    if (healthScore >= 80) {
      status = 'excellent';
      message = "Excellent! You're saving well and managing your finances effectively.";
    } else if (healthScore >= 60) {
      status = 'good';
      message = "Good! You're on the right track with your financial management.";
    } else if (healthScore >= 40) {
      status = 'fair';
      message = "You're making progress, but there's room for improvement.";
    }

    // Provide tailored advice based on financial behavior
     const advice: string[] = [];
    if (savingsRatio < 20) {
      advice.push("Aim to save at least 20% of your income each month.");
    }
    if (uniqueCategories < 5) {
      advice.push("Consider tracking expenses across more categories for better insights.");
    }
    if (avgTransactionsPerDay < 0.5) {
      advice.push("Log your transactions more regularly for accurate tracking.");
    }
    if (totalExpenses > totalIncome) {
      advice.push("Your expenses exceed your income. Consider reducing non-essential spending.");
    }
    if (currentMonthSavings < 0) {
      advice.push("This month, your expenses have exceeded your income. Review your spending.");
    }

    return {
      status,
      message,
      score: Math.round(healthScore),
      advice: advice.length > 0 ? advice : ["Keep up the good work!"]
    };
 }, [savingsRatio, categoryDiversity, consistencyScore, totalIncome, totalExpenses, currentMonthSavings]); // Dependencies for health calculation

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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:items-start gap-1">
            <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Your financial overview at a glance</p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex flex-wrap gap-3">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Button onClick={() => navigate('/income')} variant="outline" className="shadow-sm flex-1 add-income-button">
                  <Plus className="mr-2 h-4 w-4" /> Add Income
              </Button>
                <Button onClick={() => navigate('/expenses')} className="flex-1 add-expense-button">
                  <Plus className="mr-2 h-4 w-4" /> Add Expense
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button onClick={() => navigate('/budget')} variant="outline" className="shadow-sm flex-1">
                  <Calculator className="mr-2 h-4 w-4" /> Budget
              </Button>
              <Button onClick={() => navigate('/reports')} variant="outline" className="shadow-sm flex-1">
                  <ExternalLink className="mr-2 h-4 w-4" /> Reports
              </Button>
              </div>
            </div>
          </div>
        </div>

        {/* === Onboarding Alert === */}
        {!isLoading && filteredIncome.length === 0 && filteredExpenses.length === 0 && (
          <Alert variant="default" className="bg-blue-50 border border-blue-200 text-blue-800">
            <AlertTitle className="text-blue-900 font-semibold">Get Started with Diligence Finance!</AlertTitle>
            <AlertDescription>
              Record your first income or expense transaction to unlock insights and track your financial health.
            </AlertDescription>
          </Alert>
        )}
        {/* === End Onboarding Alert === */}

        {/* Timeframe selector */}
        <Tabs value={timeframe} onValueChange={(value) => setTimeframe(value as 'week' | 'month' | 'year')} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
            <TabsTrigger value="year">This Year</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Summary cards */}
        {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                 {[...Array(6)].map((_, i) => <Card key={i} className="shadow-sm animate-pulse h-32"><CardHeader><div className="h-4 bg-muted rounded w-3/4 mb-2"></div><div className="h-8 bg-muted rounded w-1/2"></div></CardHeader></Card>)}
            </div>
        ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <Card className="shadow-sm">
            <CardHeader className="pb-2">
                        <CardDescription>Total Income ({timeframe})</CardDescription>
              <CardTitle className="text-xl sm:text-xl flex items-center">
                {formatCurrency(totalIncome)}
                <TrendingUp className="ml-2 h-5 w-5 text-income" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                            From {filteredIncome.length} transactions
              </div>
            </CardContent>
          </Card>
                <Card className="shadow-sm">
            <CardHeader className="pb-2">
                        <CardDescription>Total Expenses ({timeframe})</CardDescription>
              <CardTitle className="text-xl sm:text-xl flex items-center">
                {formatCurrency(totalExpenses)}
                <TrendingDown className="ml-2 h-5 w-5 text-expense" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                            From {filteredExpenses.length} transactions
              </div>
            </CardContent>
          </Card>
                <Card className="shadow-sm">
            <CardHeader className="pb-2">
                        <CardDescription>Net Balance ({timeframe})</CardDescription>
              <CardTitle className={`text-xl sm:text-lg ${balance >= 0 ? 'text-income' : 'text-expense'}`}>
                {formatCurrency(balance)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                            {balance >= 0 ? 'On track!' : 'Spending exceeds income'}
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription>Avg. Daily Expenses ({timeframe})</CardDescription>
                        <CardTitle className="text-xl sm:text-xl flex items-center">
                            {formatCurrency(averageDailyExpenses)}
                             <Clock className="ml-2 h-5 w-5 text-muted-foreground" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground">
                            Based on {numberOfDaysInFilter} days
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
                        <CardDescription>Current Month Savings</CardDescription>
              <CardTitle className={`text-xl sm:text-xl ${currentMonthSavings >= 0 ? 'text-income' : 'text-expense'}`}>
                {formatCurrency(currentMonthSavings)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {currentMonthSavings >= 0 
                  ? "You're saving well this month!" 
                  : "Your expenses exceed your income this month."}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription>Upcoming Month Recurring</CardDescription>
                        <CardTitle className={`text-xl sm:text-xl flex items-center ${upcomingRecurring.upcomingThisMonthTotal >= 0 ? 'text-expense' : 'text-income'}`}>
                            {formatCurrency(Math.abs(upcomingRecurring.upcomingThisMonthTotal))}
                            <Repeat className="ml-2 h-5 w-5 text-muted-foreground" />
                        </CardTitle>
            </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground">
                            Net total of scheduled expenses minus income
                        </div>
                    </CardContent>
                </Card>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button variant="primary" className="shadow-sm col-span-2 md:col-span-1 w-full md:w-auto">
                      View Financial Health
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Financial Health</DialogTitle>
                      <DialogDescription>
                        Based on saving habits & activities
                      </DialogDescription>
                    </DialogHeader>
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className={`text-xl font-semibold inline-block ${
                      financialHealth && financialHealth.status === 'excellent' ? 'text-green-500' :
                      financialHealth && financialHealth.status === 'good' ? 'text-blue-500' :
                      financialHealth && financialHealth.status === 'fair' ? 'text-yellow-500' :
                      'text-red-500'
                    }`}>
                      {financialHealth && financialHealth.status === 'excellent' ? 'Excellent' :
                       financialHealth && financialHealth.status === 'good' ? 'Good' :
                       financialHealth && financialHealth.status === 'fair' ? 'Fair' :
                       'Needs Attention'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold inline-block text-muted-foreground">
                      Score: {financialHealth ? financialHealth.score : 0}/100
                    </span>
                  </div>
                </div>
                <div className="flex h-2 overflow-hidden rounded bg-muted/30">
                  <div style={{ width: `${financialHealth ? financialHealth.score : 0}%` }} 
                    className={`${
                      financialHealth && financialHealth.status === 'excellent' ? 'bg-green-500' :
                      financialHealth && financialHealth.status === 'good' ? 'bg-blue-500' :
                      financialHealth && financialHealth.status === 'fair' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}>
                  </div>
                </div>
              </div>
              
              <p className="text-muted-foreground">{financialHealth ? financialHealth.message : 'Loading financial health data...'}</p>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Suggestions for Improvement:</h4>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  {financialHealth && financialHealth.advice && financialHealth.advice.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
                  </DialogContent>
                </Dialog>
        </div>
        )}

        {/* Charts section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Income vs Expenses</CardTitle>
              <CardDescription>
                {timeframe === 'week' ? 'Daily breakdown by day of week' : 
                 timeframe === 'month' ? 'Weekly breakdown (Sun-Sat)' : 
                 'Monthly comparison'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[300px] w-full">
                        {isLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="animate-pulse text-muted-foreground">Loading chart...</div>
                  </div>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 11, fontWeight: 600 }}
                      />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend />
                      <Bar dataKey="Income" fill="#00C49F" />
                      <Bar dataKey="Expenses" fill="#FF5A5F" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center">
                    <p className="text-muted-foreground mb-4">No data available for this period</p>
                    <Button variant="outline" onClick={() => navigate('/income')}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Transaction
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Expense Categories</CardTitle>
              <CardDescription>Where your money is going</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[300px] w-full">
                        {isLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="animate-pulse text-muted-foreground">Loading chart...</div>
                  </div>
                ) : pieChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData && pieChartData.length > 0 && pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center">
                    <p className="text-muted-foreground mb-4">No expense data available for this period</p>
                    <Button variant="outline" onClick={() => navigate('/expenses')}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Expense
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Transactions List */}
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Upcoming Recurring Transactions (Next 7 Days)</CardTitle>
                    <CardDescription>Scheduled automatic payments and income.</CardDescription>
                </div>
                 <Button variant="outline" size="sm" className="h-8" onClick={() => navigate('/recurring')}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Manage Rules
                </Button>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                     <p>Loading upcoming transactions...</p>
                ) : upcomingRecurring.next7Days.length > 0 ? (
                    <div className="space-y-4">
                        {upcomingRecurring.next7Days.map((rule) => (
                            <div key={rule.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="flex items-center space-x-4">
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${rule.type === 'income' ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'}`}>
                                        <Repeat className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">
                                            {rule.category || rule.description || 'Recurring Item'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Due: {formatDate(rule.next_due_date)} ({rule.frequency})
                                        </p>
                                    </div>
                                </div>
                                <p className={`font-medium ${rule.type === 'income' ? 'text-income' : 'text-expense'}`}>
                                    {rule.type === 'income' ? '+' : '-'}
                                    {formatCurrency(rule.amount)}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6">
                        <p className="text-muted-foreground">No recurring transactions due in the next 7 days.</p>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* Recent transactions */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Your latest financial activity</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="h-8" onClick={() => navigate('/reports')}>
              <ExternalLink className="mr-2 h-4 w-4" />
              View All
            </Button>
          </CardHeader>
          <CardContent>
                {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex justify-between items-center p-2">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-full bg-muted"></div>
                      <div className="space-y-2">
                        <div className="h-4 w-24 bg-muted rounded"></div>
                        <div className="h-3 w-16 bg-muted rounded"></div>
                      </div>
                    </div>
                    <div className="h-4 w-16 bg-muted rounded"></div>
                  </div>
                ))}
              </div>
            ) : recentTransactions.length > 0 ? (
              <div className="space-y-4">
                        {recentTransactions.map((transaction) => (
                  <div key={`${transaction.id}-${transaction.date}`} className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${transaction.type === 'income' ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'}`}>
                        {transaction.type === 'income' ? (
                          <ArrowUpRight className="h-5 w-5" />
                        ) : (
                          <TrendingDown className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {transaction.type === 'income' ? 'Income' : transaction.category}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(transaction.date)}
                        </p>
                      </div>
                    </div>
                    <p className={`font-medium ${transaction.type === 'income' ? 'text-income' : 'text-expense'}`}>
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">No transactions yet</p>
                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={() => navigate('/income')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Income
                  </Button>
                  <Button onClick={() => navigate('/expenses')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Expense
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Money Flow Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Money Flow Analysis</CardTitle>
            <CardDescription>Breakdown of your income and expenses</CardDescription>
          </CardHeader>
          <CardContent>
                {isLoading ? ( <p>Loading analysis...</p> ) : (
            <div className="space-y-4">
              <div>
                            <h4 className="font-medium text-sm">Top Income Sources ({timeframe})</h4>
                            {topIncomeSources.length > 0 ? topIncomeSources.map((source, index) => (
                  <div key={`income-${source.description}-${index}`} className="flex justify-between mt-2">
                    <span className="text-sm">{source.description || 'Unnamed'}</span>
                    <span className="text-sm font-medium">{formatCurrency(source.amount)}</span>
                  </div>
                            )) : <p className="text-xs text-muted-foreground">No income in this period.</p>}
              </div>
              
              <div>
                            <h4 className="font-medium text-sm">Top Expense Categories ({timeframe})</h4>
                            {topExpenseCategories.length > 0 ? topExpenseCategories.map((category, index) => (
                  <div key={`expense-${category.name}-${index}`} className="flex justify-between mt-2">
                    <span className="text-sm">{category.name}</span>
                    <span className="text-sm font-medium">{formatCurrency(category.amount)}</span>
                  </div>
                            )) : <p className="text-xs text-muted-foreground">No expenses in this period.</p>}
              </div>
            </div>
                )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
