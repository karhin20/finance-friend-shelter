import { useState, useEffect, useMemo, useCallback } from 'react';
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
  startOfWeek, endOfWeek,
  addMonths, subMonths,
  addYears, subYears,
  addWeeks, subWeeks,
  isWithinInterval,
  getYear, getMonth
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useFinance } from '@/contexts/FinanceContext';
import { DateRange } from 'react-day-picker';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  const { incomeQuery, expensesQuery, filters, setFilters } = useFinance();
  const { data: filteredIncome = [], isLoading: isIncomeLoading } = incomeQuery;
  const { data: filteredExpenses = [], isLoading: isExpensesLoading } = expensesQuery;
  const isLoading = isIncomeLoading || isExpensesLoading;
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [currentPeriod, setCurrentPeriod] = useState(() => new Date());
  const [comparePeriod, setComparePeriod] = useState<'none' | 'previous_period' | 'previous_year'>('none');
  const [compareIncome, setCompareIncome] = useState<Income[]>([]);
  const [compareExpenses, setCompareExpenses] = useState<Expense[]>([]);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);
  const [compareLabel, setCompareLabel] = useState<string | null>(null);
  const [incomeCategoryData, setIncomeCategoryData] = useState<{ [key: string]: number }>({});
  const [averageExpense, setAverageExpense] = useState<number>(0);
  const [largestExpense, setLargestExpense] = useState<number>(0);

  const COLORS = ['#0A84FF', '#00C49F', '#FF5A5F', '#FFBB28', '#AF52DE', '#FF9500', '#5856D6', '#5AC8FA', '#30B0C7'];

  const { start, end, label } = useMemo(() => {
    const weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1;
    let rangeStart: Date, rangeEnd: Date, rangeLabel: string;

    if (timeRange === 'week') {
      rangeStart = startOfWeek(currentPeriod, { weekStartsOn });
      rangeEnd = endOfWeek(currentPeriod, { weekStartsOn });
      rangeLabel = `${format(rangeStart, 'MMM d')} - ${format(rangeEnd, 'MMM d, yyyy')}`;
    } else if (timeRange === 'month') {
      rangeStart = startOfMonth(currentPeriod);
      rangeEnd = endOfMonth(currentPeriod);
      rangeLabel = format(currentPeriod, 'MMMM yyyy');
    } else {
      rangeStart = startOfYear(currentPeriod);
      rangeEnd = endOfYear(currentPeriod);
      rangeLabel = format(currentPeriod, 'yyyy');
    }
    rangeEnd.setHours(23, 59, 59, 999);
    return { start: rangeStart, end: rangeEnd, label: rangeLabel };
  }, [timeRange, currentPeriod]);

  useEffect(() => {
    if (filters.dateRange?.from?.getTime() !== start.getTime() || filters.dateRange?.to?.getTime() !== end.getTime()) {
      console.log(`Reports: Setting context date range for ${label}:`, { from: start, to: end });
      setFilters(prev => ({ ...prev, dateRange: { from: start, to: end } }));
    }
  }, [start, end, setFilters, filters.dateRange]);

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const amount = direction === 'prev' ? -1 : 1;
    if (timeRange === 'week') {
      setCurrentPeriod(prev => addWeeks(prev, amount));
    } else if (timeRange === 'month') {
      setCurrentPeriod(prev => addMonths(prev, amount));
    } else {
      setCurrentPeriod(prev => addYears(prev, amount));
    }
  };

  const totalIncome = filteredIncome.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : '0.0';

  const categoryData = filteredExpenses.reduce((acc: { [key: string]: number }, expense) => {
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

  const getTimeSeriesData = () => {
    const incomeMap: Record<string, number> = {};
    const expenseMap: Record<string, number> = {};

    const getDateKey = (dateStr: string) => {
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Invalid Date';

        if (timeRange === 'week') {
          return format(date, 'EEE');
        } else if (timeRange === 'month') {
          return format(date, 'd');
        } else {
          return format(date, 'MMM');
        }
      } catch (e) {
          console.error("Error formatting date:", dateStr, e);
          return 'Error Date';
      }
    };

    filteredIncome.forEach(item => {
      const key = getDateKey(item.date);
      if (key !== 'Invalid Date' && key !== 'Error Date') {
        incomeMap[key] = (incomeMap[key] || 0) + item.amount;
      }
    });

    filteredExpenses.forEach(item => {
      const key = getDateKey(item.date);
       if (key !== 'Invalid Date' && key !== 'Error Date') {
        expenseMap[key] = (expenseMap[key] || 0) + item.amount;
      }
    });

    const keys = Array.from(new Set([...Object.keys(incomeMap), ...Object.keys(expenseMap)]));

    if (timeRange === 'week') {
        const dayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        keys.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
    } else if (timeRange === 'year') {
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        keys.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
    } else {
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-md p-3 shadow-sm">
          <p className="font-medium">{
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

  useEffect(() => {
    // Income by Category
    const newIncomeCategoryData = filteredIncome.reduce((acc: { [key: string]: number }, income) => {
      if (!acc[income.category]) {
        acc[income.category] = 0;
      }
      acc[income.category] += income.amount;
      return acc;
    }, {});
    setIncomeCategoryData(newIncomeCategoryData);

    // Average Expense
    const totalExpenseAmount = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
    setAverageExpense(filteredExpenses.length > 0 ? totalExpenseAmount / filteredExpenses.length : 0);

    // Largest Expense
    setLargestExpense(filteredExpenses.reduce((max, item) => Math.max(max, item.amount), 0));
  }, [filteredIncome, filteredExpenses]);

  useEffect(() => {
    const getCompareRange = (): { start: Date; end: Date; label: string } | null => {
      if (comparePeriod === 'none') return null;

      let compareStart: Date, compareEnd: Date, label: string;
      const currentStart = start;

      if (comparePeriod === 'previous_period') {
        if (timeRange === 'week') {
          compareStart = subWeeks(currentStart, 1);
          compareEnd = endOfWeek(compareStart, { weekStartsOn: 1 });
          label = `Prev. Week (${format(compareStart, 'MMM d')})`;
        } else if (timeRange === 'month') {
          compareStart = subMonths(currentStart, 1);
          compareEnd = endOfMonth(compareStart);
          label = `Prev. Month (${format(compareStart, 'MMMM')})`;
        } else {
          compareStart = subYears(currentStart, 1);
          compareEnd = endOfYear(compareStart);
          label = `Prev. Year (${format(compareStart, 'yyyy')})`;
        }
      } else {
        compareStart = subYears(currentStart, 1);
        if (timeRange === 'week') compareEnd = endOfWeek(addWeeks(compareStart, getMonth(currentStart)*4 + date.getDate()/7), { weekStartsOn: 1});
        else if (timeRange === 'month') compareEnd = endOfMonth(addMonths(compareStart, getMonth(currentStart)));
        else compareEnd = endOfYear(compareStart);
        label = `Same Period Last Year (${format(compareStart, 'yyyy')})`;
      }
      compareEnd.setHours(23, 59, 59, 999);
      return { start: compareStart, end: compareEnd, label };
    };

    const fetchCompareData = async () => {
      const range = getCompareRange();
      setCompareLabel(range?.label || null);

      if (!range || !user) {
        setCompareIncome([]);
        setCompareExpenses([]);
        return;
      }

      setIsLoadingCompare(true);
      try {
        const [incRes, expRes] = await Promise.all([
          supabase.from('income').select('*').eq('user_id', user.id).gte('date', range.start.toISOString()).lte('date', range.end.toISOString()),
          supabase.from('expenses').select('*').eq('user_id', user.id).gte('date', range.start.toISOString()).lte('date', range.end.toISOString())
        ]);
        if (incRes.error) throw incRes.error;
        if (expRes.error) throw expRes.error;
        setCompareIncome(incRes.data || []);
        setCompareExpenses(expRes.data || []);
      } catch (error: any) {
        console.error("Error fetching comparison data:", error);
        toast({ title: "Error", description: "Could not load comparison data.", variant: "destructive" });
        setCompareIncome([]);
        setCompareExpenses([]);
      } finally {
        setIsLoadingCompare(false);
      }
    };

    fetchCompareData();

  }, [comparePeriod, start, end, timeRange, user, toast]);

  const totalCompareIncome = compareIncome.reduce((sum, item) => sum + item.amount, 0);
  const totalCompareExpenses = compareExpenses.reduce((sum, item) => sum + item.amount, 0);
  const compareBalance = totalCompareIncome - totalCompareExpenses;

  const calculateChange = (current: number, previous: number): string => {
    if (previous === 0) return current === 0 ? '0%' : '+∞%';
    const change = ((current - previous) / Math.abs(previous)) * 100;
    if (isNaN(change) || !isFinite(change)) return '-';
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  };

  const totalIncomeChange = calculateChange(totalIncome, totalCompareIncome);
  const totalExpensesChange = calculateChange(totalExpenses, totalCompareExpenses);
  const balanceChange = calculateChange(balance, compareBalance);

  const exportData = async (data: any[], filename: string, format: 'csv') => {
     if (!data || data.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }

    if (format === 'csv') {
      const filteredData = data.map(item => {
        const { user_id, ...rest } = item; // Remove user_id
        return rest;
      });

      const headers = Object.keys(filteredData[0]).join(',');
      const rows = filteredData.map(item => Object.values(item).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
      a.download = `${filename}_${label.replace(/[\s,-]+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    }
  };

  const hasIncomeData = filteredIncome.length > 0;
  const hasExpensesData = filteredExpenses.length > 0;
  const hasTimeSeriesData = timeSeriesData.length > 0;
  const hasPieChartData = pieChartData.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">Analyze your financial data and track progress</p>
        </div>

        {/* === Onboarding Alert === */}
        {!hasIncomeData && !hasExpensesData && (
          <Alert variant="default" className="bg-blue-50 border border-blue-200 text-blue-800">
            <AlertTitle className="text-blue-900 font-semibold">No Data Available!</AlertTitle>
            <AlertDescription>
              Add income and expense transactions to generate reports and analytics.
            </AlertDescription>
          </Alert>
        )}
        {/* === End Onboarding Alert === */}

        <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-card shadow-sm">
           <Button
            variant="ghost"
            size="icon"
            onClick={() => navigatePeriod('prev')}
            disabled={isLoading}
            aria-label={`Previous ${timeRange}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Button>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">Viewing data for</p>
            <p className="font-semibold text-lg">{label}</p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigatePeriod('next')}
            disabled={isLoading}
             aria-label={`Next ${timeRange}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
             <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
            </TabsList>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <Label htmlFor="timeRange" className="sr-only">Time Range</Label>
               <Select
                value={timeRange}
                onValueChange={(value: 'week' | 'month' | 'year') => {
                  setTimeRange(value);
                  setCurrentPeriod(new Date());
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {isLoading && !hasIncomeData && !hasExpensesData ? (
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
                      <Card className="shadow-sm">
                        <CardHeader className="pb-2">
                          <CardDescription>Total Income</CardDescription>
                          <CardTitle className="text-2xl text-income">{formatCurrency(totalIncome)}</CardTitle>
                          {comparePeriod !== 'none' && <p className="text-sm text-muted-foreground">
                            {compareLabel}: {formatCurrency(totalCompareIncome)} ({totalIncomeChange})
                          </p>}
                        </CardHeader>
                      </Card>
                      <Card className="shadow-sm">
                        <CardHeader className="pb-2">
                          <CardDescription>Total Expenses</CardDescription>
                          <CardTitle className="text-2xl text-expense">{formatCurrency(totalExpenses)}</CardTitle>
                          {comparePeriod !== 'none' && <p className="text-sm text-muted-foreground">
                            {compareLabel}: {formatCurrency(totalCompareExpenses)} ({totalExpensesChange})
                          </p>}
                        </CardHeader>
                      </Card>
                      <Card className="shadow-sm">
                        <CardHeader className="pb-2">
                          <CardDescription>Net Balance</CardDescription>
                          <CardTitle className={`text-2xl ${balance >= 0 ? 'text-saving' : 'text-expense'}`}>{formatCurrency(balance)}</CardTitle>
                          {comparePeriod !== 'none' && <p className="text-sm text-muted-foreground">
                            {compareLabel}: {formatCurrency(compareBalance)} ({balanceChange})
                          </p>}
                        </CardHeader>
                      </Card>
                      <Card className="shadow-sm">
                        <CardHeader className="pb-2">
                          <CardDescription>Savings Rate</CardDescription>
                        <CardTitle className={`text-2xl ${parseFloat(savingsRate) >= 0 ? 'text-saving' : 'text-expense'}`}>{savingsRate}%</CardTitle>
                        </CardHeader>
                      </Card>
                    </>
                  )}
              </div>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Income vs Expenses</CardTitle>
                <CardDescription>Comparison for the selected {timeRange}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full relative">
                   {isLoading && hasTimeSeriesData && <ChartLoadingState />}
                   {isLoading && !hasTimeSeriesData && <ChartLoadingState />}
                   {!isLoading && !hasTimeSeriesData && <ChartNoDataState message="No income or expense data for this period." />}

                   {hasTimeSeriesData && (
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={timeSeriesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                         <CartesianGrid strokeDasharray="3 3" />
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

          <TabsContent value="expenses" className="space-y-6">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Expense Categories</CardTitle>
                  <CardDescription>Breakdown of spending by category</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="h-[350px] w-full relative">
                      {isLoading && hasPieChartData && <ChartLoadingState height={350} />}
                      {isLoading && !hasPieChartData && <ChartLoadingState height={350} />}
                      {!isLoading && !hasPieChartData && <ChartNoDataState message="No expense data for this period." height={350} />}

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

              <Card className="shadow-sm">
                 <CardHeader>
                  <CardTitle>Expense Breakdown</CardTitle>
                  <CardDescription>Detailed view of spending by category</CardDescription>
                </CardHeader>
                <CardContent className="h-[398px] overflow-y-auto">
                   {isLoading && !hasPieChartData && (
                     <div className="space-y-4 animate-pulse">
                       {[...Array(5)].map((_, i) => (
                         <div key={i} className="flex justify-between p-2 border rounded-lg"><div className="flex items-center w-full"><div className="w-3 h-3 rounded-full mr-3 bg-muted"></div><div className="h-4 bg-muted rounded w-1/3"></div></div><div className="h-4 bg-muted rounded w-1/4"></div></div>
                       ))}
                     </div>
                   )}
                   {!isLoading && !hasPieChartData && (
                      <ChartNoDataState message="No expense data to display." height={200} />
                   )}
                   {hasPieChartData && (
                     <div className="space-y-3">
                       {pieChartData.map((category, index) => (
                         <div key={category.name} className="flex justify-between items-center p-2 rounded-lg border hover:bg-muted/50 transition-colors"><div className="flex items-center overflow-hidden mr-2"><div className="w-3 h-3 rounded-full mr-3 flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} aria-hidden="true"></div><span className="truncate" title={category.name}>{category.name}</span></div><div className="space-x-4 flex items-center flex-shrink-0"><span className="text-muted-foreground text-sm w-12 text-right">{totalExpenses > 0 ? ((category.value / totalExpenses) * 100).toFixed(1) : '0.0'}%</span><span className="font-medium w-20 text-right">{formatCurrency(category.value)}</span></div></div>
                       ))}
                     </div>
                   )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="income" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Income Categories</CardTitle>
                  <CardDescription>Breakdown of income by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px] w-full relative">
                    {isLoading && !hasIncomeData && <ChartLoadingState height={350} />}
                    {!isLoading && !hasIncomeData && <ChartNoDataState message="No income data for this period." height={350} />}

                    {hasIncomeData && (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={Object.entries(incomeCategoryData).map(([name, value]) => ({ name, value }))}
                            cx="50%" cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={120} fill="#8884d8" dataKey="value"
                          >
                            {Object.entries(incomeCategoryData).map(([category, value], index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Legend layout="scrollable" verticalAlign="bottom" align="center" />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Income Breakdown</CardTitle>
                  <CardDescription>Detailed view of income by category</CardDescription>
                </CardHeader>
                <CardContent className="h-[398px] overflow-y-auto">
                  {isLoading && !hasIncomeData && (
                    <div className="space-y-4 animate-pulse">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex justify-between p-2 border rounded-lg">
                          <div className="flex items-center w-full">
                            <div className="w-3 h-3 rounded-full mr-3 bg-muted"></div>
                            <div className="h-4 bg-muted rounded w-1/3"></div>
                          </div>
                          <div className="h-4 bg-muted rounded w-1/4"></div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!isLoading && !hasIncomeData && (
                    <ChartNoDataState message="No income data to display." height={200} />
                  )}
                  {hasIncomeData && (
                    <div className="space-y-3">
                      {Object.entries(incomeCategoryData).map(([category, value], index) => (
                        <div key={category} className="flex justify-between items-center p-2 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-center overflow-hidden mr-2">
                            <div className="w-3 h-3 rounded-full mr-3 flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} aria-hidden="true"></div>
                            <span className="truncate" title={category}>{category}</span>
                          </div>
                          <div className="space-x-4 flex items-center flex-shrink-0">
                            <span className="text-muted-foreground text-sm w-12 text-right">{totalIncome > 0 ? ((value / totalIncome) * 100).toFixed(1) : '0.0'}%</span>
                            <span className="font-medium w-20 text-right">{formatCurrency(value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Balance Trend</CardTitle>
                  <CardDescription>How your net balance changed over the {timeRange}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px] w-full relative">
                    {isLoading && hasTimeSeriesData && <ChartLoadingState />}
                    {isLoading && !hasTimeSeriesData && <ChartLoadingState />}
                    {!isLoading && !hasTimeSeriesData && <ChartNoDataState message="No data available to show trend." />}
                    {hasTimeSeriesData && (
                       <ResponsiveContainer width="100%" height="100%"><LineChart data={timeSeriesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip content={<CustomTooltip />} /><Legend /><Line type="monotone" dataKey="Balance" stroke="#0A84FF" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Income & Expenses Over Time</CardTitle>
                  <CardDescription>Progression during the selected {timeRange}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px] w-full relative">
                    {isLoading && hasTimeSeriesData && <ChartLoadingState />}
                    {isLoading && !hasTimeSeriesData && <ChartLoadingState />}
                    {!isLoading && !hasTimeSeriesData && <ChartNoDataState message="No income or expense data for trend." />}
                    {hasTimeSeriesData && (
                      <ResponsiveContainer width="100%" height="100%"><LineChart data={timeSeriesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip content={<CustomTooltip />} /><Legend /><Line type="monotone" dataKey="Income" stroke="#00C49F" strokeWidth={2} dot={{ r: 4 }} /><Line type="monotone" dataKey="Expenses" stroke="#FF5A5F" strokeWidth={2} dot={{ r: 4 }} /></LineChart></ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
          </TabsContent>
        </Tabs>

         <div className="mt-4 flex flex-col sm:flex-row items-center justify-end gap-4">
          <Button variant="outline" onClick={() => exportData(filteredIncome, 'income-export', 'csv')} disabled={isLoading || !hasIncomeData} aria-disabled={isLoading || !hasIncomeData} title={!hasIncomeData ? "No income data to export" : isLoading ? "Loading data..." : "Export income data"}><Download className="h-4 w-4 mr-2" />Export Income (CSV)</Button>
          <Button variant="outline" onClick={() => exportData(filteredExpenses, 'expenses-export', 'csv')} disabled={isLoading || !hasExpensesData} aria-disabled={isLoading || !hasExpensesData} title={!hasExpensesData ? "No expense data to export" : isLoading ? "Loading data..." : "Export expense data"}><Download className="h-4 w-4 mr-2" />Export Expenses (CSV)</Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;