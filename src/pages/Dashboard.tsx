import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, formatCurrency, formatDate, Income, Expense } from '@/lib/supabase';
import { BarChart, PieChart, Pie, Bar, XAxis, YAxis, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, TrendingUp, TrendingDown, DollarSign, Plus, ExternalLink, Calculator } from 'lucide-react';


const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState<Income[]>(() => {
    const cachedIncome = localStorage.getItem('dashboard_income');
    return cachedIncome ? JSON.parse(cachedIncome) : [];
  });
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const cachedExpenses = localStorage.getItem('dashboard_expenses');
    return cachedExpenses ? JSON.parse(cachedExpenses) : [];
  });
  const [timeframe, setTimeframe] = useState('month');


  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
 
        const today = new Date();
        let startDate = new Date();
        
        if (timeframe === 'week') {
          startDate.setDate(today.getDate() - 7);
        } else if (timeframe === 'month') {
          startDate.setMonth(today.getMonth() - 1);
        } else if (timeframe === 'year') {
          startDate.setFullYear(today.getFullYear() - 1);
        }

        const startDateStr = startDate.toISOString();
        
        // Fetch income
        const { data: incomeData, error: incomeError } = await supabase
          .from('income')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startDateStr)
          .order('date', { ascending: false });

        if (incomeError) throw incomeError;
        setIncome(incomeData || []);
        localStorage.setItem('dashboard_income', JSON.stringify(incomeData || []));

        // Fetch expenses
        const { data: expensesData, error: expensesError } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startDateStr)
          .order('date', { ascending: false });

        if (expensesError) throw expensesError;
        setExpenses(expensesData || []);
        localStorage.setItem('dashboard_expenses', JSON.stringify(expensesData || []));
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, timeframe]);

  // Calculate summary metrics
  const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
  const balance = totalIncome - totalExpenses;

  // Prepare data for expense categories pie chart
  const categoryData = expenses.reduce((acc: { [key: string]: number }, expense) => {
    if (!acc[expense.category]) {
      acc[expense.category] = 0;
    }
    acc[expense.category] += expense.amount;
    return acc;
  }, {});

  const pieChartData = Object.keys(categoryData).map(category => ({
    name: category,
    value: categoryData[category]
  }));

  // Prepare data for income vs expenses bar chart
  // Group by week/month depending on timeframe
  const groupedData = () => {
    const incomeMap: Record<string, number> = {};
    const expenseMap: Record<string, number> = {};
    
    // Format based on timeframe
    const getDateKey = (dateStr: string) => {
      const date = new Date(dateStr);
      
      if (timeframe === 'week') {
        // Show day of week (Sun, Mon, etc.)
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return daysOfWeek[date.getDay()];
      } else if (timeframe === 'month') {
        // Get the day of week (0 = Sunday, 6 = Saturday)
        const dayOfWeek = date.getDay();
        // Calculate the date of the previous Sunday (or the same date if it's already Sunday)
        const sunday = new Date(date);
        sunday.setDate(date.getDate() - dayOfWeek);
        // Format as "DD MMM - DD MMM"
        const saturdayDate = new Date(sunday);
        saturdayDate.setDate(sunday.getDate() + 6);
        
        // Format the dates as "D MMM"
        const formatDate = (d: Date) => {
          const day = d.getDate();
          const month = d.toLocaleString('default', { month: 'short' }).toUpperCase();
          return `${day} ${month}`;
        };
        return `${formatDate(sunday)} - ${formatDate(saturdayDate)}`;
      } else {
        return date.toLocaleString('default', { month: 'short' });
      }
    };
    
    // Add income data
    income.forEach(item => {
      const key = getDateKey(item.date);
      incomeMap[key] = (incomeMap[key] || 0) + item.amount;
    });
    
    // Add expense data
    expenses.forEach(item => {
      const key = getDateKey(item.date);
      expenseMap[key] = (expenseMap[key] || 0) + item.amount;
    });
    
    // Combine into format needed for chart
    const keys = [...new Set([...Object.keys(incomeMap), ...Object.keys(expenseMap)])];
    
    // Sort the keys appropriately by timeframe
    const sortedKeys = [...keys].sort((a, b) => {
      if (timeframe === 'week') {
        // Sort by day of week (Sun, Mon, Tue, etc.)
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return daysOfWeek.indexOf(a) - daysOfWeek.indexOf(b);
      } else if (timeframe === 'month') {
        // Extract the dates from "D MMM - D MMM" and sort by the start date
        const getStartDate = (weekStr: string) => {
          const dateStr = weekStr.split(' - ')[0];
          const day = parseInt(dateStr.split(' ')[0]);
          const month = dateStr.split(' ')[1];
          const monthIndex = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].indexOf(month);
          // Use current year (this is fine for sorting within a month)
          return new Date(new Date().getFullYear(), monthIndex, day);
        };
        // Sort from earliest to latest
        return getStartDate(a).getTime() - getStartDate(b).getTime();
      } else {
        // For year view, sort months chronologically
        const monthOrder = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        return (monthOrder[a as keyof typeof monthOrder] || 0) - (monthOrder[b as keyof typeof monthOrder] || 0);
      }
    });
    
    return sortedKeys.map(key => ({
      name: key,
      Income: incomeMap[key] || 0,
      Expenses: expenseMap[key] || 0
    }));
  };

  const chartData = groupedData();

  // Colors for charts
  const COLORS = ['#0A84FF', '#00C49F', '#FF5A5F', '#FFBB28', '#AF52DE', '#FF9500', '#5856D6'];

  // Recent transactions (combined and sorted)
  const recentTransactions = useMemo(() => {
    try {
      if (!income || !income.length || !expenses || !expenses.length) {
        return [];
      }
      
      return [
        ...(income || []).map(item => ({
          ...item,
          type: 'income',
          category: 'Income' // Add a default category for income items
        })), 
        ...(expenses || []).map(item => ({
          ...item,
          type: 'expense'
        }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
    } catch (error) {
      console.error('Error processing transactions:', error);
      return [];
    }
  }, [income, expenses]);

  // Improved implementation
  const isCurrentMonth = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    return date.getMonth() === now.getMonth() && 
           date.getFullYear() === now.getFullYear();
  };

  // And update where it's used:
  const currentMonthIncome = income
    .filter(t => isCurrentMonth(t.date))
    .reduce((sum, t) => sum + t.amount, 0);

  const currentMonthExpenses = expenses
    .filter(t => isCurrentMonth(t.date))
    .reduce((sum, t) => sum + t.amount, 0);

  const currentMonthSavings = currentMonthIncome - currentMonthExpenses;

  // First, let's fix the savingsRatio error by moving it outside the function
  // Add this calculation after currentMonthSavings
  const savingsRatio = currentMonthIncome > 0 
    ? (currentMonthSavings / currentMonthIncome) * 100 
    : 0;

  // Add these calculations at the component level (near where we defined savingsRatio)
  // Get unique categories from expenses
  const categories = expenses.map(e => e.category);
  const uniqueCategories = new Set(categories).size;
  const categoryDiversity = uniqueCategories > 0 
    ? Math.min(uniqueCategories / 5, 1) * 100 
    : 0;

  // Calculate consistency - how regularly they're tracking finances
  const oldestTransaction = useMemo(() => {
    try {
      if (!recentTransactions || recentTransactions.length === 0) {
        return new Date();
      }
      return new Date(Math.min(...recentTransactions.map(t => new Date(t.date).getTime())));
    } catch (error) {
      console.error('Error calculating oldest transaction:', error);
      return new Date();
    }
  }, [recentTransactions]);

  const daysSinceFirst = Math.max(1, Math.floor((new Date().getTime() - oldestTransaction.getTime()) / (1000 * 60 * 60 * 24)));
  const avgTransactionsPerDay = recentTransactions && recentTransactions.length > 0 ? recentTransactions.length / daysSinceFirst : 0;
  const consistencyScore = Math.min(avgTransactionsPerDay * 10, 100);

  // Then update the getFinancialHealthStatus function
  const getFinancialHealthStatus = () => {
    if (!recentTransactions || recentTransactions.length === 0) 
      return { status: 'neutral', message: 'Not enough data yet', score: 0, advice: [] };

    // Calculate overall financial health score (weighted average)
    const weights = { savings: 0.5, diversity: 0.3, consistency: 0.2 };
    const healthScore = (
      (savingsRatio * weights.savings) + 
      (categoryDiversity * weights.diversity) + 
      (consistencyScore * weights.consistency)
    );

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
    const advice = [];
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
  };

  // Then add this to your dashboard
  const financialHealth = useMemo(getFinancialHealthStatus, [recentTransactions, savingsRatio, categoryDiversity, consistencyScore]);

  // Add more detailed financial analytics
  const topIncomeSources = income?.map(item => ({
    description: item.category || 'Income',
    amount: item.amount
  })) || [];

  const topExpenseCategories = expenses?.map(item => ({
    name: item.category || 'Uncategorized',
    amount: item.amount
  })) || [];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Your financial overview at a glance</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button onClick={() => navigate('/income')} variant="outline" className="shadow-sm flex-1">
                <Plus className="mr-2 h-4 w-4" />
                Add Income
              </Button>
              <Button onClick={() => navigate('/expenses')} className="flex-1">
                <Plus className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button onClick={() => navigate('/budget')} variant="outline" className="shadow-sm flex-1">
                <Calculator className="mr-2 h-4 w-4" />
                Budget
              </Button>
              <Button onClick={() => navigate('/reports')} variant="outline" className="shadow-sm flex-1">
                <ExternalLink className="mr-2 h-4 w-4" />
                Reports
              </Button>
            </div>
          </div>
        </div>

        {/* Timeframe selector */}
        <Tabs value={timeframe} onValueChange={setTimeframe} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
            <TabsTrigger value="year">This Year</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardDescription>Total Income</CardDescription>
              <CardTitle className="text-2xl flex items-center">
                {formatCurrency(totalIncome)}
                <TrendingUp className="ml-2 h-5 w-5 text-income" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                From {income.length} transactions
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardDescription>Total Expenses</CardDescription>
              <CardTitle className="text-2xl flex items-center">
                {formatCurrency(totalExpenses)}
                <TrendingDown className="ml-2 h-5 w-5 text-expense" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                From {expenses.length} transactions
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardDescription>Current Balance</CardDescription>
              <CardTitle className={`text-2xl ${balance >= 0 ? 'text-income' : 'text-expense'}`}>
                {formatCurrency(balance)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {balance >= 0 ? 'You\'re on track!' : 'Spending exceeds income'}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Monthly Savings</CardDescription>
              <CardTitle className={`text-2xl ${currentMonthSavings >= 0 ? 'text-income' : 'text-expense'}`}>
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
            <CardHeader>
              <CardTitle>Financial Health</CardTitle>
              <CardDescription>Based on your saving habits and activities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>
        </div>

        {/* Charts section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income vs Expenses chart */}
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
                {loading ? (
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

          {/* Expense Categories chart */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Expense Categories</CardTitle>
              <CardDescription>Where your money is going</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[300px] w-full">
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
            {loading ? (
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
                {recentTransactions && recentTransactions.map((transaction) => (
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
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm">Top Income Sources</h4>
                {topIncomeSources && topIncomeSources.length > 0 && topIncomeSources.map((source, index) => (
                  <div key={`income-${source.description}-${index}`} className="flex justify-between mt-2">
                    <span className="text-sm">{source.description || 'Unnamed'}</span>
                    <span className="text-sm font-medium">{formatCurrency(source.amount)}</span>
                  </div>
                ))}
              </div>
              
              <div>
                <h4 className="font-medium text-sm">Top Expense Categories</h4>
                {topExpenseCategories && topExpenseCategories.length > 0 && topExpenseCategories.map((category, index) => (
                  <div key={`expense-${category.name}-${index}`} className="flex justify-between mt-2">
                    <span className="text-sm">{category.name}</span>
                    <span className="text-sm font-medium">{formatCurrency(category.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
