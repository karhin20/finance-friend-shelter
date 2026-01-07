import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Income, Expense } from '@/lib/supabase';
import { useCurrency } from '@/contexts/CurrencyContext';
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
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import {
  format,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  startOfWeek, endOfWeek,
  startOfDay, endOfDay,
  addMonths, subMonths,
  addYears, subYears,
  addWeeks, subWeeks,
  addDays, subDays,
  isWithinInterval,
  getYear, getMonth
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { Download, Loader2, FileText, Calendar as CalendarIcon } from 'lucide-react';
import { useFinance } from '@/contexts/FinanceContext';
import { DateRange } from 'react-day-picker';
import jsPDF from 'jspdf';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

// --- Helper Components ---
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
  const { formatCurrency } = useCurrency();
  const { incomeQuery, expensesQuery, filters, setFilters } = useFinance();
  const { data: filteredIncome = [], isLoading: isIncomeLoading } = incomeQuery;
  const { data: filteredExpenses = [], isLoading: isExpensesLoading } = expensesQuery;
  const isLoading = isIncomeLoading || isExpensesLoading;

  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [currentPeriod, setCurrentPeriod] = useState(() => new Date());
  // Initialize custom range to current month
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  const [comparePeriod, setComparePeriod] = useState<'none' | 'previous_period' | 'previous_year'>('none');
  const [compareIncome, setCompareIncome] = useState<Income[]>([]);
  const [compareExpenses, setCompareExpenses] = useState<Expense[]>([]);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);
  const [compareLabel, setCompareLabel] = useState<string | null>(null);

  const [incomeCategoryData, setIncomeCategoryData] = useState<{ [key: string]: number }>({});
  const [averageExpense, setAverageExpense] = useState<number>(0);
  const [largestExpense, setLargestExpense] = useState<number>(0);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const COLORS = ['#0A84FF', '#00C49F', '#FF5A5F', '#FFBB28', '#AF52DE', '#FF9500', '#5856D6', '#5AC8FA', '#30B0C7'];

  // Calculate start, end, and label based on timeRange
  const { start, end, label } = useMemo(() => {
    let rangeStart: Date, rangeEnd: Date, rangeLabel: string;

    if (timeRange === 'custom' && customDateRange?.from) {
      rangeStart = customDateRange.from;
      rangeEnd = customDateRange.to || customDateRange.from; // Default to single day if no end date
      rangeLabel = `${format(rangeStart, 'MMM d, yyyy')} - ${format(rangeEnd, 'MMM d, yyyy')}`;
    } else if (timeRange === 'day') {
      rangeStart = startOfDay(currentPeriod);
      rangeEnd = endOfDay(currentPeriod);
      rangeLabel = format(currentPeriod, 'MMMM d, yyyy');
    } else if (timeRange === 'week') {
      rangeStart = startOfWeek(currentPeriod, { weekStartsOn: 1 });
      rangeEnd = endOfWeek(currentPeriod, { weekStartsOn: 1 });
      rangeLabel = `${format(rangeStart, 'MMM d')} - ${format(rangeEnd, 'MMM d, yyyy')}`;
    } else if (timeRange === 'month') {
      rangeStart = startOfMonth(currentPeriod);
      rangeEnd = endOfMonth(currentPeriod);
      rangeLabel = format(currentPeriod, 'MMMM yyyy');
    } else {
      // year
      rangeStart = startOfYear(currentPeriod);
      rangeEnd = endOfYear(currentPeriod);
      rangeLabel = format(currentPeriod, 'yyyy');
    }

    // Ensure end of day
    const adjustedEnd = new Date(rangeEnd);
    adjustedEnd.setHours(23, 59, 59, 999);

    return { start: rangeStart, end: adjustedEnd, label: rangeLabel };
  }, [timeRange, currentPeriod, customDateRange]);

  // Update global filters when local range changes
  useEffect(() => {
    if (filters.dateRange?.from?.getTime() !== start.getTime() || filters.dateRange?.to?.getTime() !== end.getTime()) {
      setFilters(prev => ({ ...prev, dateRange: { from: start, to: end } }));
    }
  }, [start, end, setFilters, filters.dateRange]);

  const navigatePeriod = (direction: 'prev' | 'next') => {
    if (timeRange === 'custom') return; // Navigation disabled for custom range

    const amount = direction === 'prev' ? -1 : 1;
    if (timeRange === 'day') {
      setCurrentPeriod(prev => addDays(prev, amount));
    } else if (timeRange === 'week') {
      setCurrentPeriod(prev => addWeeks(prev, amount));
    } else if (timeRange === 'month') {
      setCurrentPeriod(prev => addMonths(prev, amount));
    } else {
      setCurrentPeriod(prev => addYears(prev, amount));
    }
  };

  // --- Statistics ---
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

  // --- Timeseries Data Construction ---
  const getTimeSeriesData = () => {
    const incomeMap: Record<string, number> = {};
    const expenseMap: Record<string, number> = {};

    const getDateKey = (dateStr: string) => {
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Invalid Date';

        if (timeRange === 'day') {
          return format(date, 'h a'); // Hourly
        } else if (timeRange === 'week' || timeRange === 'custom') {
          // For custom ranges shorter than a month, show days. 
          // If custom range is long, ideally we'd switch to months, but for simplicity showing days or basic format:
          return format(date, 'MMM d');
        } else if (timeRange === 'month') {
          return format(date, 'd');
        } else {
          return format(date, 'MMM');
        }
      } catch (e) {
        return 'Error Date';
      }
    };

    filteredIncome.forEach(item => {
      const key = getDateKey(item.date);
      incomeMap[key] = (incomeMap[key] || 0) + item.amount;
    });

    filteredExpenses.forEach(item => {
      const key = getDateKey(item.date);
      expenseMap[key] = (expenseMap[key] || 0) + item.amount;
    });

    const keys = Array.from(new Set([...Object.keys(incomeMap), ...Object.keys(expenseMap)]));

    // Sort keys
    if (timeRange === 'year') {
      const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      keys.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
    } else if (timeRange === 'day') {
      // Sort by hour
      const getHourValue = (h: string) => {
        // Create a dummy date with the hour string to sort correctly (e.g. 1 PM vs 11 AM)
        const date = new Date(`2000/01/01 ${h}`);
        return date.getTime();
      };
      keys.sort((a, b) => getHourValue(a) - getHourValue(b));
    } else if (timeRange === 'month') {
      keys.sort((a, b) => parseInt(a) - parseInt(b));
    } else {
      // Chronological sort for 'MMM d'
      keys.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
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
          <p className="font-medium">{label}</p>
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
    const newIncomeCategoryData = filteredIncome.reduce((acc: { [key: string]: number }, income) => {
      if (!acc[income.category]) { acc[income.category] = 0; }
      acc[income.category] += income.amount;
      return acc;
    }, {});
    setIncomeCategoryData(newIncomeCategoryData);

    const totalExpenseAmount = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
    setAverageExpense(filteredExpenses.length > 0 ? totalExpenseAmount / filteredExpenses.length : 0);
    setLargestExpense(filteredExpenses.reduce((max, item) => Math.max(max, item.amount), 0));
  }, [filteredIncome, filteredExpenses]);

  // --- Comparison Logic (Disabled for Custom Range for simplicity) ---
  useEffect(() => {
    const getCompareRange = (): { start: Date; end: Date; label: string } | null => {
      if (comparePeriod === 'none' || timeRange === 'custom') return null;

      let compareStart: Date, compareEnd: Date, label: string;
      const currentStart = start;

      if (comparePeriod === 'previous_period') {
        if (timeRange === 'day') {
          compareStart = subDays(currentStart, 1);
          compareEnd = endOfDay(compareStart);
          label = 'Yesterday';
        } else if (timeRange === 'week') {
          compareStart = subWeeks(currentStart, 1);
          compareEnd = endOfWeek(compareStart, { weekStartsOn: 1 });
          label = `Prev. Week`;
        } else if (timeRange === 'month') {
          compareStart = subMonths(currentStart, 1);
          compareEnd = endOfMonth(compareStart);
          label = `Prev. Month`;
        } else {
          compareStart = subYears(currentStart, 1);
          compareEnd = endOfYear(compareStart);
          label = `Prev. Year`;
        }
      } else {
        // Last Year
        compareStart = subYears(currentStart, 1);
        if (timeRange === 'day') compareEnd = endOfDay(compareStart);
        else if (timeRange === 'week') compareEnd = endOfWeek(addWeeks(compareStart, getMonth(currentStart) * 4 + currentStart.getDate() / 7), { weekStartsOn: 1 });
        else if (timeRange === 'month') compareEnd = endOfMonth(addMonths(compareStart, getMonth(currentStart)));
        else compareEnd = endOfYear(compareStart);
        label = `Last Year`;
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
      } finally {
        setIsLoadingCompare(false);
      }
    };
    fetchCompareData();
  }, [comparePeriod, start, end, timeRange, user]);

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

  // --- Export Logic ---
  const exportData = async (data: any[], filename: string, format: 'csv') => {
    if (!data || data.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }
    if (format === 'csv') {
      const filteredData = data.map(item => {
        const { user_id, ...rest } = item;
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

  // ... (PDF generation remains mostly same, elided for brevity if not changing logic)
  const generatePDF = () => {
    if (filteredExpenses.length === 0 && filteredIncome.length === 0) {
      toast({ title: "No data", description: "There is no data to generate a report for.", variant: "default" });
      return;
    }

    setIsGeneratingPDF(true);
    try {
      const doc = new jsPDF();
      doc.setFont("helvetica", "normal");

      const pageWidth = doc.internal.pageSize.getWidth();

      const cleanText = (text: string) => {
        return text.replace(/[^\x00-\x7F]/g, "");
      };

      const safeCurrency = (amount: number) => {
        const val = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
        return `${val}`;
      };

      // Title
      doc.setFontSize(22);
      doc.setTextColor(40);
      doc.text("Diligence Finance Report", pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`Generated on: ${format(new Date(), 'PPP')}`, pageWidth / 2, 28, { align: 'center' });
      doc.text(`Period: ${cleanText(label)}`, pageWidth / 2, 34, { align: 'center' });

      doc.setLineWidth(0.5);
      doc.setDrawColor(200);
      doc.line(20, 40, pageWidth - 20, 40);

      // Summary
      let yPos = 55;
      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text("Executive Summary", 20, yPos);
      yPos += 10;

      doc.setFontSize(12);
      doc.setTextColor(60);
      const leftColX = 20;
      const rightColX = pageWidth / 2 + 10;

      doc.text(`Total Income: ${safeCurrency(totalIncome)}`, leftColX, yPos);
      doc.text(`Total Expenses: ${safeCurrency(totalExpenses)}`, rightColX, yPos);
      yPos += 8;
      doc.text(`Net Balance: ${safeCurrency(balance)}`, leftColX, yPos);
      doc.text(`Savings Rate: ${savingsRate}%`, rightColX, yPos);

      yPos += 15;
      doc.line(20, yPos, pageWidth - 20, yPos);
      yPos += 15;

      // Analysis
      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text("Analysis", 20, yPos);
      yPos += 10;
      doc.setFontSize(12);
      doc.setTextColor(60);

      doc.text(`Income Transactions: ${filteredIncome.length}`, leftColX, yPos);
      doc.text(`Expense Transactions: ${filteredExpenses.length}`, rightColX, yPos);
      yPos += 8;

      const topIncomeCat = Object.entries(incomeCategoryData).sort((a, b) => b[1] - a[1])[0];
      const topIncomeName = topIncomeCat ? topIncomeCat[0] : 'None';
      const topIncomeVal = topIncomeCat ? topIncomeCat[1] : 0;
      doc.text(`Top Income Source: ${cleanText(topIncomeName)} (${safeCurrency(topIncomeVal)})`, leftColX, yPos);

      doc.text(`Largest Single Expense: ${safeCurrency(largestExpense)}`, rightColX, yPos);
      yPos += 8;
      doc.text(`Average Expense: ${safeCurrency(averageExpense)}`, rightColX, yPos);

      yPos += 15;
      doc.line(20, yPos, pageWidth - 20, yPos);
      yPos += 15;

      // Top Spending Categories
      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text("Top Spending Categories", 20, yPos);
      yPos += 10;
      doc.setFontSize(11);
      doc.setTextColor(60);

      const topCategories = pieChartData.slice(0, 10);
      if (topCategories.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.text("Category", 20, yPos);
        doc.text("Amount", 120, yPos, { align: 'right' });
        doc.text("% of Total", 170, yPos, { align: 'right' });
        doc.setFont("helvetica", "normal");
        yPos += 8;

        topCategories.forEach((cat) => {
          const percent = totalExpenses > 0 ? ((cat.value / totalExpenses) * 100).toFixed(1) : '0';
          doc.text(cleanText(cat.name), 20, yPos);
          doc.text(safeCurrency(cat.value), 120, yPos, { align: 'right' });
          doc.text(`${percent}%`, 170, yPos, { align: 'right' });
          yPos += 7;
        });
      } else {
        doc.text("No expense data available.", 20, yPos);
      }

      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text("Generated by Diligence Finance", pageWidth / 2, pageWidth + 80, { align: 'center' });

      doc.save(`Diligence_Finance_Report_${label.replace(/ /g, '_')}.pdf`);
      toast({ title: "Report Downloaded", description: "Your PDF report has been generated." });

    } catch (error: any) {
      console.error("Error generating PDF", error);
      toast({ title: "Error", description: "Failed to generate PDF report.", variant: "destructive" });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const hasIncomeData = filteredIncome.length > 0;
  const hasExpensesData = filteredExpenses.length > 0;
  const hasTimeSeriesData = timeSeriesData.length > 0;
  const hasPieChartData = pieChartData.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-10 animate-in fade-in duration-700">

        {/* Controls Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border rounded-lg bg-card shadow-sm">

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigatePeriod('prev')}
              disabled={isLoading || timeRange === 'custom'}
              className={timeRange === 'custom' ? 'opacity-30' : ''}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Button>

            <div className="text-center min-w-[200px]">
              <p className="text-sm text-muted-foreground">Viewing data for</p>
              <p className="font-semibold text-lg">{label}</p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigatePeriod('next')}
              disabled={isLoading || timeRange === 'custom'}
              className={timeRange === 'custom' ? 'opacity-30' : ''}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Button>
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto">
            {timeRange === 'custom' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !customDateRange && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDateRange?.from ? (
                      customDateRange.to ? (
                        <>
                          {format(customDateRange.from, "LLL dd, y")} -{" "}
                          {format(customDateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(customDateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customDateRange?.from}
                    selected={customDateRange}
                    onSelect={setCustomDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            )}

            <Select
              value={timeRange}
              onValueChange={(value: 'day' | 'week' | 'month' | 'year' | 'custom') => {
                setTimeRange(value);
                if (value !== 'custom') {
                  setCurrentPeriod(new Date());
                }
              }}
            >
              <SelectTrigger className="w-auto min-w-[120px] text-xs sm:text-sm h-9 sm:h-10">
                <SelectValue placeholder="Select Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Today</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
                <SelectItem value="year">Yearly</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Dashboard Content */}
        {!hasIncomeData && !hasExpensesData ? (
          <Alert variant="default" className="bg-primary/5 border-primary/20 text-primary shadow-premium rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <div className="space-y-1">
                <AlertTitle className="text-lg font-bold tracking-tight">Analytics Awaiting Data</AlertTitle>
                <AlertDescription className="text-primary/70 font-medium">
                  {timeRange === 'custom' ? "Select a date range with transactions to view stats." : "Add transactions to generate reports."}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Income</CardDescription>
                    <CardTitle className="text-2xl text-income">{formatCurrency(totalIncome)}</CardTitle>
                    {comparePeriod !== 'none' && timeRange !== 'custom' && <p className="text-sm text-muted-foreground">{compareLabel}: {formatCurrency(totalCompareIncome)} ({totalIncomeChange})</p>}
                  </CardHeader>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Expenses</CardDescription>
                    <CardTitle className="text-2xl text-expense">{formatCurrency(totalExpenses)}</CardTitle>
                    {comparePeriod !== 'none' && timeRange !== 'custom' && <p className="text-sm text-muted-foreground">{compareLabel}: {formatCurrency(totalCompareExpenses)} ({totalExpensesChange})</p>}
                  </CardHeader>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Net Balance</CardDescription>
                    <CardTitle className={`text-2xl ${balance >= 0 ? 'text-saving' : 'text-expense'}`}>{formatCurrency(balance)}</CardTitle>
                    {comparePeriod !== 'none' && timeRange !== 'custom' && <p className="text-sm text-muted-foreground">{compareLabel}: {formatCurrency(compareBalance)} ({balanceChange})</p>}
                  </CardHeader>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Savings Rate</CardDescription>
                    <CardTitle className={`text-2xl ${parseFloat(savingsRate) >= 0 ? 'text-saving' : 'text-expense'}`}>{savingsRate}%</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Income vs Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px] w-full relative">
                    {isLoading && <ChartLoadingState />}
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
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="expenses" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-sm">
                  <CardHeader><CardTitle>Distribution</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                            outerRadius={105}
                            fill="#8884d8"
                            dataKey="value"
                            paddingAngle={2}
                          >
                            {pieChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader><CardTitle>Breakdown</CardTitle></CardHeader>
                  <CardContent className="h-[350px] overflow-y-auto">
                    <div className="space-y-3">
                      {pieChartData.map((category, index) => (
                        <div key={category.name} className="flex justify-between items-center p-2 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-center">
                            <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                            <span>{category.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-muted-foreground text-sm">{totalExpenses > 0 ? ((category.value / totalExpenses) * 100).toFixed(1) : '0.0'}%</span>
                            <span className="font-medium inline-block w-20 text-right">{formatCurrency(category.value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="income" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-sm">
                  <CardHeader><CardTitle>Sources</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={Object.entries(incomeCategoryData).map(([name, value]) => ({ name, value }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                            outerRadius={105}
                            fill="#8884d8"
                            dataKey="value"
                            paddingAngle={2}
                          >
                            {Object.entries(incomeCategoryData).map(([name], index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader><CardTitle>Breakdown</CardTitle></CardHeader>
                  <CardContent className="h-[350px] overflow-y-auto">
                    <div className="space-y-3">
                      {Object.entries(incomeCategoryData).map(([name, value], index) => (
                        <div key={name} className="flex justify-between items-center p-2 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-center">
                            <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                            <span>{name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-muted-foreground text-sm">{totalIncome > 0 ? ((value / totalIncome) * 100).toFixed(1) : '0.0'}%</span>
                            <span className="font-medium inline-block w-20 text-right">{formatCurrency(value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="trends" className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader><CardTitle>Trend Over Time</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeSeriesData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Area type="monotone" dataKey="Income" stroke="#10B981" fillOpacity={1} fill="url(#colorIncome)" />
                        <Area type="monotone" dataKey="Expenses" stroke="#EF4444" fillOpacity={1} fill="url(#colorExpense)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Footer Actions */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-end gap-4">
          <Button
            variant="default"
            onClick={generatePDF}
            disabled={isLoading || isGeneratingPDF || (!hasIncomeData && !hasExpensesData)}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700"
          >
            {isGeneratingPDF ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            {isGeneratingPDF ? 'Generating Report...' : 'Download PDF Report'}
          </Button>

          <Button variant="outline" onClick={() => exportData(filteredIncome, 'income-export', 'csv')} disabled={isLoading || !hasIncomeData} className="w-full sm:w-auto"><Download className="h-4 w-4 mr-2" />Export Income (CSV)</Button>
          <Button variant="outline" onClick={() => exportData(filteredExpenses, 'expenses-export', 'csv')} disabled={isLoading || !hasExpensesData} className="w-full sm:w-auto"><Download className="h-4 w-4 mr-2" />Export Expenses (CSV)</Button>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;