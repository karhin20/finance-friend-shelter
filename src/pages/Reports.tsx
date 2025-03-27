
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
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths, subMonths } from 'date-fns';

const ReportsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [income, setIncome] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('month');
  const [currentPeriod, setCurrentPeriod] = useState(() => new Date());

  // Colors for charts
  const COLORS = ['#0A84FF', '#00C49F', '#FF5A5F', '#FFBB28', '#AF52DE', '#FF9500', '#5856D6', '#5AC8FA', '#30B0C7'];

  // Calculate date range based on timeRange and currentPeriod
  const getDateRange = () => {
    if (timeRange === 'month') {
      return {
        start: startOfMonth(currentPeriod),
        end: endOfMonth(currentPeriod),
        label: format(currentPeriod, 'MMMM yyyy')
      };
    } else {
      return {
        start: startOfYear(currentPeriod),
        end: endOfYear(currentPeriod),
        label: format(currentPeriod, 'yyyy')
      };
    }
  };

  const { start, end, label } = getDateRange();

  // Navigate to previous or next period
  const navigatePeriod = (direction: 'prev' | 'next') => {
    if (timeRange === 'month') {
      setCurrentPeriod(direction === 'prev' ? subMonths(currentPeriod, 1) : addMonths(currentPeriod, 1));
    } else {
      const newDate = new Date(currentPeriod);
      newDate.setFullYear(newDate.getFullYear() + (direction === 'prev' ? -1 : 1));
      setCurrentPeriod(newDate);
    }
  };

  // Fetch financial data
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Format dates for query
        const startStr = start.toISOString();
        const endStr = end.toISOString();
        
        // Fetch income
        const { data: incomeData, error: incomeError } = await supabase
          .from('income')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startStr)
          .lte('date', endStr)
          .order('date', { ascending: true });

        if (incomeError) throw incomeError;
        setIncome(incomeData || []);

        // Fetch expenses
        const { data: expensesData, error: expensesError } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startStr)
          .lte('date', endStr)
          .order('date', { ascending: true });

        if (expensesError) throw expensesError;
        setExpenses(expensesData || []);
      } catch (error: any) {
        console.error('Error fetching report data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load financial data. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, toast, start, end]);

  // Calculate summary metrics
  const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : '0.0';

  // Prepare data for expense categories pie chart
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
    .sort((a, b) => b.value - a.value); // Sort by value descending

  // Prepare data for income vs expenses by time
  const getTimeSeriesData = () => {
    const incomeMap: Record<string, number> = {};
    const expenseMap: Record<string, number> = {};
    
    // Format keys based on timeframe
    const getDateKey = (dateStr: string) => {
      const date = new Date(dateStr);
      return timeRange === 'month' 
        ? format(date, 'd') // Day of month
        : format(date, 'MMM'); // Month name
    };
    
    // Group income by date
    income.forEach(item => {
      const key = getDateKey(item.date);
      incomeMap[key] = (incomeMap[key] || 0) + item.amount;
    });
    
    // Group expenses by date
    expenses.forEach(item => {
      const key = getDateKey(item.date);
      expenseMap[key] = (expenseMap[key] || 0) + item.amount;
    });
    
    // Combine data
    const keys = Array.from(new Set([...Object.keys(incomeMap), ...Object.keys(expenseMap)]));
    
    // For months, ensure the keys are properly sorted
    if (timeRange === 'year') {
      const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      keys.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
    } else {
      // For days, sort numerically
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

  // Custom tooltip for charts
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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">Analyze your financial data and track progress</p>
        </div>

        {/* Time range selector */}
        <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-card shadow-sm">
          <button 
            onClick={() => navigatePeriod('prev')}
            className="p-2 rounded-md hover:bg-muted transition-colors"
            aria-label="Previous period"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Viewing data for</p>
            <p className="font-semibold text-lg">{label}</p>
          </div>
          
          <button 
            onClick={() => navigatePeriod('next')}
            className="p-2 rounded-md hover:bg-muted transition-colors"
            aria-label="Next period"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Report tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
            </TabsList>
            
            <div className="flex items-center space-x-2">
              <Label htmlFor="timeRange" className="sr-only">Time Range</Label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger id="timeRange" className="w-[140px]">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Overview tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Total Income</CardDescription>
                  <CardTitle className="text-2xl text-income">{formatCurrency(totalIncome)}</CardTitle>
                </CardHeader>
              </Card>
              
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Total Expenses</CardDescription>
                  <CardTitle className="text-2xl text-expense">{formatCurrency(totalExpenses)}</CardTitle>
                </CardHeader>
              </Card>
              
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Net Balance</CardDescription>
                  <CardTitle className={`text-2xl ${balance >= 0 ? 'text-saving' : 'text-expense'}`}>
                    {formatCurrency(balance)}
                  </CardTitle>
                </CardHeader>
              </Card>
              
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Savings Rate</CardDescription>
                  <CardTitle className={`text-2xl ${parseFloat(savingsRate) >= 0 ? 'text-saving' : 'text-expense'}`}>
                    {savingsRate}%
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Income vs Expenses Chart */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Income vs Expenses</CardTitle>
                <CardDescription>Comparison over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full">
                  {loading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="animate-pulse text-muted-foreground">Loading chart...</div>
                    </div>
                  ) : timeSeriesData.length > 0 ? (
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
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground">No data available for this period</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expenses tab */}
          <TabsContent value="expenses" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Expense Categories Chart */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Expense Categories</CardTitle>
                  <CardDescription>Breakdown of spending by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px] w-full">
                    {loading ? (
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
                            outerRadius={120}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-muted-foreground">No expense data available for this period</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Expense Categories Table */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Expense Breakdown</CardTitle>
                  <CardDescription>Detailed view of spending by category</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-4 animate-pulse">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex justify-between p-2">
                          <div className="h-6 w-24 bg-muted rounded"></div>
                          <div className="h-6 w-20 bg-muted rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : pieChartData.length > 0 ? (
                    <div className="space-y-4">
                      {pieChartData.map((category, index) => (
                        <div key={category.name} className="flex justify-between items-center p-2 rounded-lg border">
                          <div className="flex items-center">
                            <div
                              className="w-3 h-3 rounded-full mr-3"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            ></div>
                            <span>{category.name}</span>
                          </div>
                          <div className="space-x-4 flex items-center">
                            <span className="text-muted-foreground text-sm">
                              {((category.value / totalExpenses) * 100).toFixed(1)}%
                            </span>
                            <span className="font-medium">{formatCurrency(category.value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-[350px] flex items-center justify-center">
                      <p className="text-muted-foreground">No expense data available for this period</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Trends tab */}
          <TabsContent value="trends" className="space-y-6">
            {/* Balance Trend Chart */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Balance Trend</CardTitle>
                <CardDescription>How your net balance has changed over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full">
                  {loading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="animate-pulse text-muted-foreground">Loading chart...</div>
                    </div>
                  ) : timeSeriesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timeSeriesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="Balance" 
                          stroke="#0A84FF" 
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground">No data available for this period</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cumulative Line Chart */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Income & Expenses Over Time</CardTitle>
                <CardDescription>Cumulative view of your financial activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full">
                  {loading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="animate-pulse text-muted-foreground">Loading chart...</div>
                    </div>
                  ) : timeSeriesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timeSeriesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="Income" 
                          stroke="#00C49F" 
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="Expenses" 
                          stroke="#FF5A5F" 
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground">No data available for this period</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;
