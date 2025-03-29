import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, formatCurrency, Income, Expense } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import {
  format,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  startOfWeek, endOfWeek, // Import week functions
  addMonths, subMonths,
  addYears, subYears,    // Import year functions (alternative to setting year)
  addWeeks, subWeeks     // Import week navigation functions
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';

// --- Helper Components (ChartLoadingState, ChartNoDataState - Keep as before) ---
const ChartLoadingState = ({ height = 350 }: { height?: number }) => (
    <div style={{ height: `${height}px` }} className="absolute inset-0 flex items-center justify-center w-full bg-background/50 backdrop-blur-sm z-10">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

const ChartNoDataState = ({ message, height = 350 }: { message: string, height?: number }) => (
  <div style={{ height: `${height}px` }} className="flex items-center justify-center w-full">
    <p className="text-muted-foreground">{message}</p>
  </div>
);
// --- End Helper Components ---


const ReportsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [income, setIncome] = useState<Income[]>(() => {
    const cachedIncome = localStorage.getItem('income');
    return cachedIncome ? JSON.parse(cachedIncome) : [];
  });
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const cachedExpenses = localStorage.getItem('expenses');
    return cachedExpenses ? JSON.parse(cachedExpenses) : [];
  });
  const [isFetching, setIsFetching] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  // Default to month, but allow 'week'
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [currentPeriod, setCurrentPeriod] = useState(() => new Date());

  const COLORS = ['#0A84FF', '#00C49F', '#FF5A5F', '#FFBB28', '#AF52DE', '#FF9500', '#5856D6', '#5AC8FA', '#30B0C7'];

  // Calculate date range based on timeRange and currentPeriod
  const getDateRange = () => {
    // Optional: Define week start day (0=Sun, 1=Mon, etc.)
    const weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1; // Start week on Monday

    if (timeRange === 'week') {
      const start = startOfWeek(currentPeriod, { weekStartsOn });
      const end = endOfWeek(currentPeriod, { weekStartsOn });
      return {
        start,
        end,
        // Format label for clarity, e.g., "Jun 10 - Jun 16, 2024"
        label: `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
      };
    } else if (timeRange === 'month') {
      const start = startOfMonth(currentPeriod);
      const end = endOfMonth(currentPeriod);
      return {
        start,
        end,
        label: format(currentPeriod, 'MMMM yyyy')
      };
    } else { // year
      const start = startOfYear(currentPeriod);
      const end = endOfYear(currentPeriod);
      return {
        start,
        end,
        label: format(currentPeriod, 'yyyy')
      };
    }
  };

  const { start, end, label } = getDateRange();

  // Navigate to previous or next period
  const navigatePeriod = (direction: 'prev' | 'next') => {
    const amount = direction === 'prev' ? -1 : 1;
    if (timeRange === 'week') {
      setCurrentPeriod(prev => addWeeks(prev, amount));
    } else if (timeRange === 'month') {
      setCurrentPeriod(prev => addMonths(prev, amount));
    } else { // year
      setCurrentPeriod(prev => addYears(prev, amount));
    }
  };

  // Fetch financial data - useEffect remains largely the same
  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setIsFetching(false);
        return;
      }

      setIsFetching(true);
      try {
        const startStr = start.toISOString();
        const endStr = end.toISOString();

        const [incomeResult, expensesResult] = await Promise.all([
          supabase
            .from('income')
            .select('*')
            .eq('user_id', user.id)
            .gte('date', startStr)
            .lte('date', endStr)
            .order('date', { ascending: true }),
          supabase
            .from('expenses')
            .select('*')
            .eq('user_id', user.id)
            .gte('date', startStr)
            .lte('date', endStr)
            .order('date', { ascending: true })
        ]);

        if (incomeResult.error) throw incomeResult.error;
        if (expensesResult.error) throw expensesResult.error;

        setIncome(incomeResult.data || []);
        setExpenses(expensesResult.data || []);
        
        // Cache data in local storage
        localStorage.setItem('income', JSON.stringify(incomeResult.data || []));
        localStorage.setItem('expenses', JSON.stringify(expensesResult.data || []));

      } catch (error: any) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: `Failed to load financial data: ${error.message || 'Unknown error'}`,
          variant: 'destructive',
        });
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, [user, start.toISOString(), end.toISOString(), toast]);

  // --- Calculations (totalIncome, totalExpenses, balance, savingsRate, pieChartData) remain the same ---
  const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : '0.0';

  const categoryData = expenses.reduce((acc: { [key: string]: number }, expense) => {
    if (!acc[expense.category]) {
      acc[expense.category] = 0;
    }
    acc[expense.category] += expense.amount;
    return acc;
  }, {});

  const pieChartData = Object.keys(categoryData)
    .map(category => ({
      name: category,
      value: categoryData[category]
    }))
    .sort((a, b) => b.value - a.value);


  // Prepare data for income vs expenses by time
  const getTimeSeriesData = () => {
    const incomeMap: Record<string, number> = {};
    const expenseMap: Record<string, number> = {};

    // Format keys based on timeframe
    const getDateKey = (dateStr: string) => {
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Invalid Date';

        if (timeRange === 'week') {
          return format(date, 'EEE'); // Day of week (e.g., 'Mon')
        } else if (timeRange === 'month') {
          return format(date, 'd');    // Day of month (e.g., '15')
        } else { // year
          return format(date, 'MMM'); // Month abbreviation (e.g., 'Jun')
        }
      } catch (e) {
          console.error("Error formatting date:", dateStr, e);
          return 'Error Date';
      }
    };

    income.forEach(item => {
      const key = getDateKey(item.date);
      if (key !== 'Invalid Date' && key !== 'Error Date') {
        incomeMap[key] = (incomeMap[key] || 0) + item.amount;
      }
    });

    expenses.forEach(item => {
      const key = getDateKey(item.date);
       if (key !== 'Invalid Date' && key !== 'Error Date') {
        expenseMap[key] = (expenseMap[key] || 0) + item.amount;
      }
    });

    const keys = Array.from(new Set([...Object.keys(incomeMap), ...Object.keys(expenseMap)]));

    // Define sort order based on timeRange
    if (timeRange === 'week') {
        // Sort by day of the week (respecting weekStartsOn if needed, but standard order is fine)
        const dayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        // Adjust if weekStartsOn=1 (Monday)
        // const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        keys.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
    } else if (timeRange === 'year') {
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        keys.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
    } else { // month
        // Sort numerically by day
        keys.sort((a, b) => parseInt(a) - parseInt(b));
    }

    return keys.map(key => ({
      name: key,
      Income: incomeMap[key] || 0,
      Expenses: expenseMap[key] || 0,
      Balance: (incomeMap[key] || 0) - (expenseMap[key] || 0)
    }));
  };

  const timeSeriesData = getTimeSeriesData();

  // --- CustomTooltip and exportData remain the same ---
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-md p-3 shadow-sm">
          <p className="font-medium">{
            // Add context to label for week/month view if just day/number
            (timeRange === 'week' || timeRange === 'month') ? `${label} (${format(start, 'MMM d')} - ${format(end, 'MMM d')})` : label
          }</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const exportData = (data: any[], filename: string) => {
     if (!data || data.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(item => Object.values(item).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${label.replace(/[\s,-]+/g, '_')}.csv`; // Make filename safer
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


  // Determine if there's any data to show
  const hasIncomeData = income.length > 0;
  const hasExpensesData = expenses.length > 0;
  const hasTimeSeriesData = timeSeriesData.length > 0;
  const hasPieChartData = pieChartData.length > 0;


  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">Analyze your financial data and track progress</p>
        </div>

        {/* Time range selector */}
        <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-card shadow-sm">
           {/* Prev/Next Buttons (remain the same, disable logic is correct) */}
           <Button
            variant="ghost"
            size="icon"
            onClick={() => navigatePeriod('prev')}
            disabled={isFetching}
            aria-label={`Previous ${timeRange}`} // Dynamic label
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Button>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">Viewing data for</p>
            <p className="font-semibold text-lg">{label}</p> {/* Label updates automatically */}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigatePeriod('next')}
            disabled={isFetching}
             aria-label={`Next ${timeRange}`} // Dynamic label
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Button>
        </div>

        {/* Report tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
             <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
            </TabsList>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <Label htmlFor="timeRange" className="sr-only">Time Range</Label>
               <Select
                value={timeRange}
                onValueChange={(value: 'week' | 'month' | 'year') => {
                  setTimeRange(value);
                  // Optional: Reset to current date when changing range type for context
                  setCurrentPeriod(new Date());
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                   {/* ADDED This Week option */}
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                  {/* Custom range removed for simplicity, add back if needed */}
                  {/* <SelectItem value="custom">Custom Range</SelectItem> */}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Overview tab */}
          <TabsContent value="overview" className="space-y-6">
              {/* Summary cards (remain the same) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                 {/* Conditional rendering for placeholders or actual cards */}
                  {isFetching && !hasIncomeData && !hasExpensesData ? (
                    <>
                      {[...Array(4)].map((_, i) => (
                        <Card key={i} className="shadow-sm animate-pulse">
                          <CardHeader className="pb-2">
                            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                            <div className="h-8 bg-muted rounded w-1/2"></div>
                          </CardHeader>
                        </Card>
                      ))}
                    </>
                  ) : (
                    <>
                      <Card className="shadow-sm"> <CardHeader className="pb-2"><CardDescription>Total Income</CardDescription><CardTitle className="text-2xl text-income">{formatCurrency(totalIncome)}</CardTitle></CardHeader></Card>
                      <Card className="shadow-sm"> <CardHeader className="pb-2"><CardDescription>Total Expenses</CardDescription><CardTitle className="text-2xl text-expense">{formatCurrency(totalExpenses)}</CardTitle></CardHeader></Card>
                      <Card className="shadow-sm"> <CardHeader className="pb-2"><CardDescription>Net Balance</CardDescription><CardTitle className={`text-2xl ${balance >= 0 ? 'text-saving' : 'text-expense'}`}>{formatCurrency(balance)}</CardTitle></CardHeader></Card>
                      <Card className="shadow-sm"> <CardHeader className="pb-2"><CardDescription>Savings Rate</CardDescription><CardTitle className={`text-2xl ${parseFloat(savingsRate) >= 0 ? 'text-saving' : 'text-expense'}`}>{savingsRate}%</CardTitle></CardHeader></Card>
                    </>
                  )}
              </div>

            {/* Income vs Expenses Chart */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Income vs Expenses</CardTitle>
                 {/* Dynamic description */}
                <CardDescription>Comparison for the selected {timeRange}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full relative">
                   {isFetching && hasTimeSeriesData && <ChartLoadingState />}
                   {isFetching && !hasTimeSeriesData && <ChartLoadingState />}
                   {!isFetching && !hasTimeSeriesData && <ChartNoDataState message="No income or expense data for this period." />}

                   {hasTimeSeriesData && (
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={timeSeriesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                         <CartesianGrid strokeDasharray="3 3" />
                         {/* XAxis label depends on timeRange via getTimeSeriesData */}
                         <XAxis dataKey="name" />
                         <YAxis />
                         <Tooltip content={<CustomTooltip />} />
                         <Legend />
                         <Bar dataKey="Income" fill="#00C49F" />
                         <Bar dataKey="Expenses" fill="#FF5A5F" />
                       </BarChart>
                     </ResponsiveContainer>
                   )}
                 </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expenses tab (remains the same, pie chart isn't time-based) */}
          <TabsContent value="expenses" className="space-y-6">
             {/* ... Expense Pie Chart and Table code ... */}
             {/* The rendering logic inside should still use hasPieChartData etc. */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Expense Categories Chart */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Expense Categories</CardTitle>
                  <CardDescription>Breakdown of spending by category</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="h-[350px] w-full relative">
                      {isFetching && hasPieChartData && <ChartLoadingState height={350} />}
                      {isFetching && !hasPieChartData && <ChartLoadingState height={350} />}
                      {!isFetching && !hasPieChartData && <ChartNoDataState message="No expense data for this period." height={350} />}

                      {hasPieChartData && (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieChartData}
                              cx="50%" cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={120} fill="#8884d8" dataKey="value"
                            >
                              {pieChartData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}
                            </Pie>
                            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                             <Legend layout="scrollable" verticalAlign="bottom" align="center" />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                   </div>
                </CardContent>
              </Card>

              {/* Expense Categories Table */}
              <Card className="shadow-sm">
                 {/* ... Expense Breakdown Card Header ... */}
                 <CardHeader>
                  <CardTitle>Expense Breakdown</CardTitle>
                  <CardDescription>Detailed view of spending by category</CardDescription>
                </CardHeader>
                <CardContent className="h-[398px] overflow-y-auto"> {/* Match height approx and allow scroll */}
                   {isFetching && !hasPieChartData && (
                     <div className="space-y-4 animate-pulse">
                       {[...Array(5)].map((_, i) => ( /* Skeleton loader */
                         <div key={i} className="flex justify-between p-2 border rounded-lg"><div className="flex items-center w-full"><div className="w-3 h-3 rounded-full mr-3 bg-muted"></div><div className="h-4 bg-muted rounded w-1/3"></div></div><div className="h-4 bg-muted rounded w-1/4"></div></div>
                       ))}
                     </div>
                   )}
                   {!isFetching && !hasPieChartData && (
                      <ChartNoDataState message="No expense data to display." height={200} />
                   )}
                   {hasPieChartData && (
                     <div className="space-y-3">
                       {pieChartData.map((category, index) => ( /* Actual list */
                         <div key={category.name} className="flex justify-between items-center p-2 rounded-lg border hover:bg-muted/50 transition-colors"><div className="flex items-center overflow-hidden mr-2"><div className="w-3 h-3 rounded-full mr-3 flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} aria-hidden="true"></div><span className="truncate" title={category.name}>{category.name}</span></div><div className="space-x-4 flex items-center flex-shrink-0"><span className="text-muted-foreground text-sm w-12 text-right">{totalExpenses > 0 ? ((category.value / totalExpenses) * 100).toFixed(1) : '0.0'}%</span><span className="font-medium w-20 text-right">{formatCurrency(category.value)}</span></div></div>
                       ))}
                     </div>
                   )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Trends tab (remains the same, charts adapt via getTimeSeriesData) */}
          <TabsContent value="trends" className="space-y-6">
             {/* Balance Trend Chart */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Balance Trend</CardTitle>
                  <CardDescription>How your net balance changed over the {timeRange}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px] w-full relative">
                    {isFetching && hasTimeSeriesData && <ChartLoadingState />}
                    {isFetching && !hasTimeSeriesData && <ChartLoadingState />}
                    {!isFetching && !hasTimeSeriesData && <ChartNoDataState message="No data available to show trend." />}
                    {hasTimeSeriesData && ( /* Line chart code */
                       <ResponsiveContainer width="100%" height="100%"><LineChart data={timeSeriesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip content={<CustomTooltip />} /><Legend /><Line type="monotone" dataKey="Balance" stroke="#0A84FF" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Income & Expenses Over Time Chart */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Income & Expenses Over Time</CardTitle>
                  <CardDescription>Progression during the selected {timeRange}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px] w-full relative">
                    {isFetching && hasTimeSeriesData && <ChartLoadingState />}
                    {isFetching && !hasTimeSeriesData && <ChartLoadingState />}
                    {!isFetching && !hasTimeSeriesData && <ChartNoDataState message="No income or expense data for trend." />}
                    {hasTimeSeriesData && ( /* Line chart code */
                      <ResponsiveContainer width="100%" height="100%"><LineChart data={timeSeriesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip content={<CustomTooltip />} /><Legend /><Line type="monotone" dataKey="Income" stroke="#00C49F" strokeWidth={2} dot={{ r: 4 }} /><Line type="monotone" dataKey="Expenses" stroke="#FF5A5F" strokeWidth={2} dot={{ r: 4 }} /></LineChart></ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
          </TabsContent>
        </Tabs>

        {/* Export buttons (remain the same) */}
         <div className="mt-4 flex flex-col sm:flex-row items-center justify-end gap-4">
          <Button variant="outline" onClick={() => exportData(income, 'income-export')} disabled={isFetching || !hasIncomeData} aria-disabled={isFetching || !hasIncomeData} title={!hasIncomeData ? "No income data to export" : isFetching ? "Loading data..." : "Export income data"}><Download className="h-4 w-4 mr-2" />Export Income</Button>
          <Button variant="outline" onClick={() => exportData(expenses, 'expenses-export')} disabled={isFetching || !hasExpensesData} aria-disabled={isFetching || !hasExpensesData} title={!hasExpensesData ? "No expense data to export" : isFetching ? "Loading data..." : "Export expense data"}><Download className="h-4 w-4 mr-2" />Export Expenses</Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;