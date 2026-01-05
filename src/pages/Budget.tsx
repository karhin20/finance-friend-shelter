import { useState, useEffect, useMemo, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { PlusCircle, Trash2, AlertCircle, Edit, Lightbulb, Loader2, CheckCircle, Copy, Wallet, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinance } from '@/contexts/FinanceContext';
import { Category, Income } from '@/lib/supabase';
import { isWithinInterval, startOfMonth, endOfMonth, format, subMonths, addMonths } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BudgetItem {
  id: string;
  category: string;
  category_id: string;
  planned_amount: number;
  user_id: string;
  month: string;
  type: 'income' | 'expense';
}

const BudgetPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { incomeQuery, expensesQuery, categoriesQuery } = useFinance();
  const { data: allIncome = [], isLoading: isIncomeLoading } = incomeQuery;
  const { data: allExpenses = [], isLoading: isExpensesLoading } = expensesQuery;
  const { data: allCategories = [], isLoading: isLoadingCategories } = categoriesQuery;
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(() => {
    const cachedBudgetItems = localStorage.getItem('budgetItems');
    return cachedBudgetItems ? JSON.parse(cachedBudgetItems) : [];
  });
  const [isLoadingBudget, setIsLoadingBudget] = useState(true);
  const [isSubmittingBudget, setIsSubmittingBudget] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [suggestedAmount, setSuggestedAmount] = useState<number | null>(null);
  const [currentTab, setCurrentTab] = useState<'expense' | 'income'>('expense');

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<BudgetItem | null>(null);

  const expenseCategories = useMemo(() => allCategories.filter(c => c.type === 'expense'), [allCategories]);
  const incomeCategories = useMemo(() => allCategories.filter(c => c.type === 'income'), [allCategories]);

  const isOverallLoading = isIncomeLoading || isExpensesLoading || isLoadingBudget || isLoadingCategories;

  const fetchBudgetData = useCallback(async () => {
    if (!user) {
      setIsLoadingBudget(false);
      return;
    }
    setIsLoadingBudget(true);
    try {
      const { data: budgetData, error: budgetError } = await supabase
        .from('budgets')
        .select(`
          *,
          categories ( name )
        `)
        .eq('user_id', user.id)
        .eq('month', selectedMonth);

      if (budgetError) throw budgetError;

      const formattedData = budgetData?.map(item => ({
        ...item,
        category: (item.categories as any)?.name || 'Unknown Category',
      })) || [];

      setBudgetItems(formattedData as any);
      localStorage.setItem('budgetItems', JSON.stringify(formattedData)); // Refresh cache

    } catch (error: any) {
      console.error('Error fetching budget data:', error);
      toast({ title: 'Error Loading Budget', description: `Failed to load budget data. Reason: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsLoadingBudget(false);
    }
  }, [user, selectedMonth, toast]);

  useEffect(() => {
    fetchBudgetData();
  }, [fetchBudgetData]);

  useEffect(() => {
    if (currentTab !== 'expense' || !selectedCategory || allExpenses.length === 0) {
      setSuggestedAmount(null);
      return;
    }
    const today = new Date();
    const threeMonthsAgo = startOfMonth(subMonths(today, 3));
    const lastMonthEnd = endOfMonth(subMonths(today, 1));

    const relevantExpenses = allExpenses.filter(exp =>
      exp.category === selectedCategory &&
      isWithinInterval(new Date(exp.date), { start: threeMonthsAgo, end: lastMonthEnd })
    );

    if (relevantExpenses.length === 0) {
      setSuggestedAmount(0);
      return;
    }

    const monthlyTotals: Record<string, number> = {};
    relevantExpenses.forEach(exp => {
      const monthKey = format(new Date(exp.date), 'yyyy-MM');
      monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + exp.amount;
    });

    const monthlyValues = Object.values(monthlyTotals);
    const average = monthlyValues.reduce((sum, val) => sum + val, 0) / Math.max(1, monthlyValues.length);
    setSuggestedAmount(Math.round(average * 100) / 100);
  }, [selectedCategory, allExpenses, currentTab]);

  const getActualAmounts = useCallback((categoryName: string, type: 'income' | 'expense') => {
    if (!selectedMonth) return 0;
    const start = startOfMonth(new Date(selectedMonth + '-02'));
    const end = endOfMonth(start);
    end.setHours(23, 59, 59, 999);

    const dataSet = type === 'income' ? allIncome : allExpenses;

    return dataSet
      .filter(item => {
        const itemDate = new Date(item.date);
        return item.category === categoryName && isWithinInterval(itemDate, { start, end });
      })
      .reduce((sum, item) => sum + item.amount, 0);

  }, [allIncome, allExpenses, selectedMonth]);

  // --- Calculations for Summary Cards ---
  const { totalPlanned, totalActual, totalRemaining, totalPercentage } = useMemo(() => {
    const relevantBudgets = budgetItems.filter(b => b.type === currentTab);
    const relevantCategories = currentTab === 'expense' ? expenseCategories : incomeCategories;

    let plannedSum = 0;
    let actualSum = 0;

    // Use relevantCategories to drive the loop to ensure we catch actuals even without budget (optional, but focusing on budget items here)
    // Actually, we should sum planned from budget items
    plannedSum = relevantBudgets.reduce((sum, item) => sum + item.planned_amount, 0);

    // And actuals from ALL categories of that type for accurate "Actual" view?
    // Or only actuals for budgeted categories? Usually "Budget Month Overview" implies overview of the budget.
    // However, showing TOTAL spent in month vs TOTAL budget is useful.
    // Let's iterate all relevant categories to get true actuals vs planned.
    relevantCategories.forEach(cat => {
      const planned = relevantBudgets.find(b => b.category_id === cat.id)?.planned_amount || 0;
      const actual = getActualAmounts(cat.name, currentTab);
      // We already summed planned above effectively (though double check distinctness), let's just sum actuals here
      actualSum += actual;
    });

    const remaining = currentTab === 'expense' ? plannedSum - actualSum : actualSum - plannedSum;
    const percentage = plannedSum > 0 ? (actualSum / plannedSum) * 100 : 0;

    return {
      totalPlanned: plannedSum,
      totalActual: actualSum,
      totalRemaining: remaining,
      totalPercentage: percentage
    };
  }, [budgetItems, currentTab, expenseCategories, incomeCategories, getActualAmounts]);


  const handleSetOrUpdateBudget = async () => {
    const categoryInfo = (currentTab === 'expense' ? expenseCategories : incomeCategories)
      .find(c => c.id === selectedCategoryId);

    if (!user || !selectedCategoryId || !newAmount || !categoryInfo) {
      toast({ title: 'Missing Information', description: 'Please select a category and enter an amount.', variant: 'destructive' });
      return;
    }

    setIsSubmittingBudget(true);
    try {
      const plannedAmount = parseFloat(newAmount);
      if (isNaN(plannedAmount) || plannedAmount < 0) {
        toast({ title: 'Invalid Amount', description: 'Please enter a valid positive number.', variant: 'destructive' });
        setIsSubmittingBudget(false);
        return;
      }

      const existingBudget = budgetItems.find(item =>
        item.category_id === selectedCategoryId && item.month === selectedMonth
      );

      const budgetDataForInsert = {
        category_id: selectedCategoryId,
        planned_amount: plannedAmount,
        user_id: user.id,
        month: selectedMonth,
        type: currentTab,
      };
      const budgetDataForUpdate = {
        planned_amount: plannedAmount,
      };

      let updatedItem: BudgetItem | null = null;

      if (existingBudget) {
        const { data, error } = await supabase
          .from('budgets')
          .update(budgetDataForUpdate)
          .eq('id', existingBudget.id)
          .select(`*, categories ( name )`)
          .single();

        if (error) throw error;
        const categoryName = (data?.categories as any)?.name || categoryInfo.name;
        updatedItem = { ...data, category: categoryName } as BudgetItem;

        setBudgetItems(prev => prev.map(item => (item.id === existingBudget.id ? updatedItem! : item)));
        toast({ title: 'Budget Updated', description: `Budget for ${categoryInfo.name} updated.` });

      } else {
        const { data, error } = await supabase
          .from('budgets')
          .insert(budgetDataForInsert)
          .select(`*, categories ( name )`)
          .single();

        if (error) throw error;
        const categoryName = (data?.categories as any)?.name || categoryInfo.name;
        updatedItem = { ...data, category: categoryName } as BudgetItem;

        setBudgetItems(prev => [...prev, updatedItem!]);
        toast({ title: 'Budget Set', description: `Budget for ${categoryInfo.name} set.` });
      }

      setSelectedCategory('');
      setSelectedCategoryId('');
      setNewAmount('');
      setSuggestedAmount(null);

    } catch (error: any) {
      console.error('Error setting/updating budget:', error);
      toast({ title: 'Error', description: `Failed to save budget: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsSubmittingBudget(false);
    }
  };

  const confirmDeleteBudget = (budgetItem: BudgetItem) => {
    setBudgetToDelete(budgetItem);
    setDeleteDialogOpen(true);
  };

  const handleDeleteBudget = async () => {
    if (!budgetToDelete) return;

    try {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', budgetToDelete.id);

      if (error) throw error;

      setBudgetItems(prev => prev.filter(item => item.id !== budgetToDelete.id));
      toast({ title: 'Budget Removed', description: `Budget for ${budgetToDelete.category} has been removed.` });
      setDeleteDialogOpen(false);
      setBudgetToDelete(null);

    } catch (error: any) {
      console.error('Error deleting budget:', error);
      toast({ title: 'Error', description: `Failed to delete budget: ${error.message}`, variant: 'destructive' });
    }
  };

  const handleCopyLastMonth = async () => {
    if (!user) return;
    setIsSubmittingBudget(true); // Re-use loading state
    try {
      // 1. Calculate previous month string
      const [year, month] = selectedMonth.split('-').map(Number);
      const prevDate = subMonths(new Date(year, month - 1), 1);
      const prevMonthStr = format(prevDate, 'yyyy-MM');

      // 2. Fetch previous month's budget
      const { data: prevBudgets, error: fetchError } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', prevMonthStr);

      if (fetchError) throw fetchError;
      if (!prevBudgets || prevBudgets.length === 0) {
        toast({ title: 'No Data', description: `No budget found for ${format(prevDate, 'MMMM yyyy')} to copy.` });
        setIsSubmittingBudget(false);
        return;
      }

      // 3. Filter out items that already exist in current month to avoid duplicates
      const newItemsToInsert = prevBudgets.filter(prevItem =>
        !budgetItems.some(currItem => currItem.category_id === prevItem.category_id)
      ).map(item => ({
        user_id: user.id,
        month: selectedMonth,
        category_id: item.category_id,
        planned_amount: item.planned_amount,
        type: item.type
      }));

      if (newItemsToInsert.length === 0) {
        toast({ title: 'Info', description: 'All categories from last month are already set for this month.' });
        setIsSubmittingBudget(false);
        return;
      }

      // 4. Insert
      const { data: insertedData, error: insertError } = await supabase
        .from('budgets')
        .insert(newItemsToInsert)
        .select(`*, categories ( name )`);

      if (insertError) throw insertError;

      const formattedInserted = insertedData?.map(item => ({
        ...item,
        category: (item.categories as any)?.name || 'Unknown Category',
      })) || [];

      setBudgetItems(prev => [...prev, ...(formattedInserted as any)]);
      toast({ title: 'Success', description: `Copied ${formattedInserted.length} budget items from ${format(prevDate, 'MMMM')}.` });

    } catch (error: any) {
      console.error('Error copying budget:', error);
      toast({ title: 'Error', description: `Failed to copy budget: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsSubmittingBudget(false);
    }
  };

  const handleEditBudget = (budgetItem: BudgetItem) => {
    if (budgetItem.type !== currentTab) {
      setCurrentTab(budgetItem.type);
    }
    setTimeout(() => {
      setSelectedCategoryId(budgetItem.category_id);
      setSelectedCategory(budgetItem.category);
      setNewAmount(budgetItem.planned_amount.toString());
      setEditingBudgetId(budgetItem.id);
      document.getElementById('amount')?.focus();
    }, 0);
  };

  const applySuggestion = () => {
    if (suggestedAmount !== null) {
      setNewAmount(suggestedAmount.toString());
    }
  };

  const renderBudgetList = (type: 'income' | 'expense') => {
    const relevantCategories = type === 'expense' ? expenseCategories : incomeCategories;
    const relevantBudgets = budgetItems.filter(b => b.type === type);
    const displayItems = relevantCategories.map(category => {
      const budgetItem = relevantBudgets.find(b => b.category_id === category.id);
      const actual = getActualAmounts(category.name, type);
      const planned = budgetItem?.planned_amount ?? 0;
      const remaining = type === 'expense' ? planned - actual : actual - planned;
      const percentage = planned > 0 ? (actual / planned) * 100 : (actual > 0 ? 101 : 0);
      const isOverBudget = type === 'expense' && remaining < 0 && planned > 0;
      const isOverIncomeGoal = type === 'income' && remaining > 0 && planned > 0;

      if (planned === 0 && actual === 0) return null;

      return {
        ...category,
        budgetItem,
        actual,
        planned,
        remaining,
        percentage,
        isOverBudget,
        isOverIncomeGoal
      };
    }).filter(Boolean);

    if (isOverallLoading) {
      return <p className="text-center text-muted-foreground p-4">Loading budget data...</p>;
    }
    if (displayItems.length === 0) {
      return <p className="text-center text-muted-foreground p-4">No budget set and no {type} recorded for {format(new Date(selectedMonth + '-02'), 'MMMM yyyy')}.</p>;
    }

    return (
      <div className="space-y-6">
        {displayItems.map((item) => (
          <div key={item!.id} className="space-y-2 border-b pb-4 last:border-b-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="font-semibold">{item!.name}</Label>
                {item!.isOverBudget && (
                  <span title="Over budget">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  </span>
                )}
                {item!.isOverIncomeGoal && (
                  <span title="Income goal met/exceeded">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </span>
                )}
              </div>
              {item!.budgetItem && (
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditBudget(item!.budgetItem!)}
                    disabled={isSubmittingBudget}
                    title="Edit Budget Amount"
                    className="h-7 w-7"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => confirmDeleteBudget(item!.budgetItem!)}
                    disabled={isSubmittingBudget}
                    title="Delete Budget"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {item!.planned > 0 ? (
              <>
                <Progress
                  value={Math.min(item!.percentage, 100)}
                  className={cn("h-2",
                    item!.percentage > 100 ? (type === 'expense' ? 'bg-destructive/20' : 'bg-green-100') : '',
                    item!.isOverBudget ? '[&>div]:bg-destructive' : '',
                    item!.isOverIncomeGoal ? '[&>div]:bg-green-600' : ''
                  )}
                />
                <div className="flex flex-wrap justify-between text-sm gap-x-4 gap-y-1">
                  <span className={cn("text-muted-foreground", item!.isOverBudget ? 'text-destructive font-medium' : '', item!.isOverIncomeGoal ? 'text-green-600 font-medium' : '')}>
                    {type === 'expense' ? 'Spent' : 'Received'}: {formatCurrency(item!.actual)}
                  </span>
                  <span className="text-muted-foreground">
                    {type === 'expense' ? 'Remaining' : 'Difference'}: {formatCurrency(item!.remaining)}
                  </span>
                  <span className="text-muted-foreground">
                    Budget: {formatCurrency(item!.planned)}
                  </span>
                </div>
                {item!.isOverBudget && (
                  <p className="text-xs text-destructive">
                    Over budget by {formatCurrency(Math.abs(item!.remaining))}
                  </p>
                )}
                {item!.isOverIncomeGoal && type === 'income' && (
                  <p className="text-xs text-green-600">
                    Goal exceeded by {formatCurrency(Math.abs(item!.remaining))}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No budget set. Current {type === 'expense' ? 'spending' : 'income'}: {formatCurrency(item!.actual)}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Top Controls: Month Selector + Copy Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4 bg-card p-2 rounded-lg border shadow-sm">
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedCategory('');
                setSelectedCategoryId('');
                setNewAmount('');
                setSuggestedAmount(null);
              }}
              className="w-[180px] border-none shadow-none focus-visible:ring-0"
              disabled={isOverallLoading || isSubmittingBudget}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLastMonth}
            disabled={isSubmittingBudget}
            title="Copy budget items from previous month"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Previous Month
          </Button>
        </div>

        {/* Summary Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-sm border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Planned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary opacity-70" />
                {formatCurrency(totalPlanned)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                For {currentTab}s in {format(new Date(selectedMonth + '-02'), 'MMM yyyy')}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Actual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold flex items-center gap-2",
                currentTab === 'expense' && totalActual > totalPlanned ? "text-destructive" : "text-blue-600"
              )}>
                {currentTab === 'expense' ? <TrendingDown className="h-5 w-5 opacity-70" /> : <TrendingUp className="h-5 w-5 opacity-70" />}
                {formatCurrency(totalActual)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalPercentage.toFixed(1)}% of budget
              </p>
            </CardContent>
          </Card>

          <Card className={cn("shadow-sm border-l-4",
            totalRemaining < 0 ? "border-l-destructive" : "border-l-green-500"
          )}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {currentTab === 'expense' ? 'Remaining' : 'Difference'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold flex items-center gap-2",
                totalRemaining < 0 && currentTab === 'expense' ? "text-destructive" : "text-green-600"
              )}>
                <PiggyBank className="h-5 w-5 opacity-70" />
                {formatCurrency(totalRemaining)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalRemaining < 0
                  ? (currentTab === 'expense' ? 'Over budget' : 'Under goal')
                  : (currentTab === 'expense' ? 'Left to spend' : 'Above goal')}
              </p>
            </CardContent>
          </Card>
        </div>


        <Card className="shadow-sm border-0 bg-transparent">
          {/* Using transparent background to let the tabs stand out or integrate better */}
          <CardHeader className="px-0 pt-0">
            {/* Header removed from here to reduce clutter, moved tabs to be primary nav for this section */}
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={currentTab} onValueChange={(value) => {
              setCurrentTab(value as 'expense' | 'income');
              setSelectedCategory('');
              setSelectedCategoryId('');
              setNewAmount('');
              setSuggestedAmount(null);
            }}>

              <div className="flex flex-col space-y-6">
                {/* Tab List */}
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                  <TabsTrigger value="expense">Expenses</TabsTrigger>
                  <TabsTrigger value="income">Income</TabsTrigger>
                </TabsList>

                {/* Edit/Add Form - Contextual to the tab */}
                <Card className="border-dashed bg-muted/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Manage {currentTab === 'expense' ? 'Expense' : 'Income'} Budget</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select
                          value={selectedCategoryId}
                          onValueChange={(value) => {
                            const selectedCat = (currentTab === 'expense' ? expenseCategories : incomeCategories).find(c => c.id === value);
                            setSelectedCategoryId(value);
                            setSelectedCategory(selectedCat?.name || '');
                          }}
                          disabled={isOverallLoading || isSubmittingBudget}
                        >
                          <SelectTrigger id="category" className="bg-background">
                            <SelectValue placeholder={`Select ${currentTab} category`} />
                          </SelectTrigger>
                          <SelectContent>
                            {isLoadingCategories ? (
                              <SelectItem value="loading" disabled>Loading...</SelectItem>
                            ) : (currentTab === 'expense' ? expenseCategories : incomeCategories).length === 0 ? (
                              <SelectItem value="no-cat" disabled>No {currentTab} categories defined</SelectItem>
                            ) : (
                              (currentTab === 'expense' ? expenseCategories : incomeCategories).map(category => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-full sm:w-auto space-y-2">
                        <Label htmlFor="amount">Budget Amount</Label>
                        <div className="flex flex-col xs:flex-row gap-2 items-stretch xs:items-center">
                          <Input
                            id="amount" type="number" step="0.01" min="0"
                            value={newAmount}
                            onChange={(e) => setNewAmount(e.target.value)}
                            placeholder="0.00"
                            disabled={isOverallLoading || isSubmittingBudget}
                            className="w-full xs:w-[150px] bg-background"
                          />
                          {currentTab === 'expense' && selectedCategory && suggestedAmount !== null && (
                            <Button
                              type="button" variant="ghost" size="sm"
                              onClick={applySuggestion}
                              title={`Apply suggested amount: ${formatCurrency(suggestedAmount)}`}
                              className="whitespace-nowrap h-10 text-xs text-muted-foreground hover:text-primary"
                              disabled={isSubmittingBudget}
                            >
                              <Lightbulb className="h-3 w-3 mr-1" />
                              {formatCurrency(suggestedAmount)}?
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="w-full sm:w-auto pt-2 sm:pt-0">
                        <Button
                          onClick={handleSetOrUpdateBudget}
                          disabled={!selectedCategoryId || !newAmount || isOverallLoading || isSubmittingBudget}
                          className="w-full sm:w-auto h-10"
                        >
                          {isSubmittingBudget ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                          {isSubmittingBudget ? 'Saving...' : (budgetItems.find(item => item.category_id === selectedCategoryId && item.month === selectedMonth) ? 'Update' : 'Set')}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* List Content */}
                <TabsContent value="expense" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Expense Breakdown</CardTitle>
                      <CardDescription>Track spending against budget.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {renderBudgetList('expense')}
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="income" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Income Breakdown</CardTitle>
                      <CardDescription>Track realized income against goals.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {renderBudgetList('income')}
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>

            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the budget for <strong>{budgetToDelete?.category}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBudget} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </DashboardLayout>
  );
};

export default BudgetPage;