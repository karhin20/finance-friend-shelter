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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Category, Income } from '@/lib/supabase';
import { isWithinInterval, startOfMonth, endOfMonth, format, subMonths, addMonths } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
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
  const queryClient = useQueryClient();
  const { data: allIncome = [], isLoading: isIncomeLoading } = incomeQuery;
  const { data: allExpenses = [], isLoading: isExpensesLoading } = expensesQuery;
  const { data: allCategories = [], isLoading: isLoadingCategories } = categoriesQuery;

  // --- Date State ---
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // --- Data Fetching with Cache ---
  const { data: budgetItems = [], isLoading: isLoadingBudget } = useQuery({
    queryKey: ['budgets', user?.id, selectedMonth],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('budgets')
        .select(`*, categories ( name )`)
        .eq('user_id', user.id)
        .eq('month', selectedMonth);

      if (error) {
        console.error('Error fetching budget data:', error);
        throw error;
      }
      return data?.map(item => ({
        ...item,
        category: (item.categories as any)?.name || 'Unknown Category',
      })) as BudgetItem[] || [];
    },
    enabled: !!user && !!selectedMonth,
    staleTime: 1000 * 60 * 30, // 30 minutes cache
  });

  const [isSubmittingBudget, setIsSubmittingBudget] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [suggestedAmount, setSuggestedAmount] = useState<number | null>(null);
  const [currentTab, setCurrentTab] = useState<'expense' | 'income'>('expense');

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<BudgetItem | null>(null);

  const expenseCategories = useMemo(() => allCategories.filter(c => c.type === 'expense'), [allCategories]);
  const incomeCategories = useMemo(() => allCategories.filter(c => c.type === 'income'), [allCategories]);

  const isOverallLoading = isIncomeLoading || isExpensesLoading || isLoadingBudget || isLoadingCategories;



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

        // Invalidate cache
        queryClient.invalidateQueries({ queryKey: ['budgets', user.id, selectedMonth] });

        toast({ title: 'Budget Updated', description: `Budget for ${categoryInfo.name} updated.` });

      } else {
        const { data, error } = await supabase
          .from('budgets')
          .insert(budgetDataForInsert)
          .select(`*, categories ( name )`)
          .single();

        if (error) throw error;

        // Invalidate cache
        queryClient.invalidateQueries({ queryKey: ['budgets', user.id, selectedMonth] });

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

      setBudgetToDelete(null);

      // Invalidate cache
      queryClient.invalidateQueries({ queryKey: ['budgets', user?.id, selectedMonth] });

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

      toast({ title: 'Success', description: `Copied ${insertedData?.length} budget items from ${format(prevDate, 'MMMM')}.` });

      // Invalidate cache
      queryClient.invalidateQueries({ queryKey: ['budgets', user?.id, selectedMonth] });

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
      const percentage = planned > 0 ? (actual / planned) * 100 : (actual > 0 ? 100 : 0);
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
      return (
        <div className="flex flex-col items-center justify-center p-12 space-y-4 text-muted-foreground animate-pulse">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading budget data...</p>
        </div>
      );
    }
    if (displayItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-2xl bg-muted/20">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Wallet className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium">No {type} budgets found</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            No budget rules set and no {type} transactions recorded for {format(new Date(selectedMonth + '-02'), 'MMMM yyyy')}.
          </p>
        </div>
      );
    }

    return (
      <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {displayItems.map((item) => (
          <Card key={item!.id} className={cn(
            "overflow-hidden border-border/40 shadow-sm hover:shadow-md transition-all duration-300",
            item!.isOverBudget && "border-destructive/30 bg-destructive/5"
          )}>
            <CardContent className="p-5">
              {/* Header Row */}
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-lg">{item!.name}</span>
                    {/* Status Badges */}
                    {item!.isOverBudget && <Badge variant="destructive" className="rounded-md shadow-sm">Over Budget</Badge>}
                    {item!.isOverIncomeGoal && <Badge variant="default" className="rounded-md bg-green-500 hover:bg-green-600 shadow-sm border-none">Goal Met</Badge>}
                    {(!item!.isOverBudget && !item!.isOverIncomeGoal && item!.planned > 0) && (
                      <Badge variant="outline" className="rounded-md font-normal text-muted-foreground">On Track</Badge>
                    )}
                    {item!.planned === 0 && (
                      <Badge variant="secondary" className="rounded-md font-normal bg-muted text-muted-foreground hover:bg-muted">No Budget</Badge>
                    )}
                  </div>
                </div>
                {/* Actions (Only if budgeted) */}
                {item!.budgetItem && (
                  <div className="flex items-center gap-1 opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditBudget(item!.budgetItem!)}
                      disabled={isSubmittingBudget}
                      title="Edit Budget Amount"
                      className="h-8 w-8 rounded-full hover:bg-background/80 text-muted-foreground hover:text-foreground"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => confirmDeleteBudget(item!.budgetItem!)}
                      disabled={isSubmittingBudget}
                      title="Delete Budget"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Progress & Stats */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm items-end">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">
                      {type === 'expense' ? 'Spent' : 'Received'}
                    </span>
                    <span className="text-xl font-bold font-mono tracking-tight">
                      {formatCurrency(item!.actual)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-primary">{Math.min(item!.percentage, 100).toFixed(0)}%</span>
                  </div>
                </div>

                <Progress
                  value={Math.min(item!.percentage, 100)}
                  className={cn("h-3 rounded-full bg-muted/50",
                    item!.isOverBudget ? '[&>div]:bg-destructive' : '',
                    item!.isOverIncomeGoal ? '[&>div]:bg-green-600' : ''
                  )}
                />

                <div className="flex justify-between items-center pt-3 mt-2 border-t border-border/40 text-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Remaining</span>
                    <span className={cn("font-bold font-mono text-base",
                      item!.remaining < 0 ? "text-destructive" : (type === 'income' ? "text-muted-foreground" : "text-emerald-600")
                    )}>{formatCurrency(item!.remaining)}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Budget</span>
                    <span className="font-bold font-mono text-base text-muted-foreground">{formatCurrency(item!.planned)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* === Toolbar === */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-[2rem] bg-white/50 dark:bg-card/50 border border-border/40 backdrop-blur-sm gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Budget Month</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setSelectedCategory('');
                  setSelectedCategoryId('');
                  setNewAmount('');
                  setSuggestedAmount(null);
                }}
                disabled={isOverallLoading || isSubmittingBudget}
                className="bg-transparent border-none p-0 h-6 text-lg font-bold focus:ring-0 cursor-pointer text-foreground"
              />
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLastMonth}
            disabled={isSubmittingBudget}
            className="rounded-xl h-10 border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors text-xs font-bold uppercase tracking-wider"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Last Month
          </Button>
        </div>

        {/* === Summary Cards Grid === */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-sm border-none bg-gradient-to-br from-primary/5 to-primary/10 relative overflow-hidden">
            <CardHeader className="pb-2 relative z-10">
              <CardTitle className="text-xs font-bold text-primary/70 uppercase tracking-widest">Total Planned</CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-black text-primary tracking-tight">
                {formatCurrency(totalPlanned)}
              </div>
              <p className="text-xs font-medium text-primary/60 mt-1">
                {currentTab === 'expense' ? 'Limit' : 'Goal'} for {format(new Date(selectedMonth + '-02'), 'MMMM')}
              </p>
            </CardContent>
            <Wallet className="absolute right-4 bottom-4 h-24 w-24 text-primary/5 z-0 rotate-12" />
          </Card>

          <Card className="shadow-sm border-none bg-card relative overflow-hidden group hover:shadow-md transition-all">
            <div className={cn("absolute top-0 left-0 w-1 h-full", currentTab === 'expense' ? (totalActual > totalPlanned ? "bg-destructive" : "bg-blue-500") : "bg-green-500")}></div>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Actual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn("text-3xl font-black tracking-tight",
                currentTab === 'expense' && totalActual > totalPlanned ? "text-destructive" : "text-foreground"
              )}>
                {formatCurrency(totalActual)}
              </div>
              <p className="text-xs font-medium text-muted-foreground mt-1">
                {totalPercentage.toFixed(0)}% used
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-none bg-card relative overflow-hidden group hover:shadow-md transition-all">
            <div className={cn("absolute top-0 left-0 w-1 h-full", totalRemaining < 0 ? "bg-destructive" : (currentTab === 'expense' ? "bg-emerald-500" : "bg-blue-500"))}></div>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                {currentTab === 'expense' ? 'Remaining' : 'Difference'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn("text-3xl font-black tracking-tight",
                totalRemaining < 0 ? "text-destructive" : "text-emerald-600"
              )}>
                {formatCurrency(totalRemaining)}
              </div>
              <p className="text-xs font-medium text-muted-foreground mt-1">
                {totalRemaining < 0 ? "Over budget" : "Available"}
              </p>
            </CardContent>
          </Card>
        </div>


        {/* === Main Content Tabs === */}
        <Tabs value={currentTab} onValueChange={(value) => {
          setCurrentTab(value as 'expense' | 'income');
          setSelectedCategory('');
          setSelectedCategoryId('');
          setNewAmount('');
          setSuggestedAmount(null);
        }}>

          <div className="flex items-center justify-between mb-6">
            <TabsList className="bg-muted/50 p-1 rounded-2xl h-auto inline-flex">
              <TabsTrigger value="expense" className="rounded-xl px-6 py-2 text-sm font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">Expenses</TabsTrigger>
              <TabsTrigger value="income" className="rounded-xl px-6 py-2 text-sm font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">Income</TabsTrigger>
            </TabsList>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* === Left: Management Form === */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="border-border/60 shadow-lg shadow-primary/5 rounded-[1.5rem] sticky top-6">
                <CardHeader>
                  <CardTitle className="text-lg">Manage Budget</CardTitle>
                  <CardDescription>Set limits for {currentTab} categories</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</Label>
                    <Select
                      value={selectedCategoryId}
                      onValueChange={(value) => {
                        const selectedCat = (currentTab === 'expense' ? expenseCategories : incomeCategories).find(c => c.id === value);
                        setSelectedCategoryId(value);
                        setSelectedCategory(selectedCat?.name || '');
                      }}
                      disabled={isOverallLoading || isSubmittingBudget}
                    >
                      <SelectTrigger id="category" className="h-12 rounded-xl bg-muted/50 border-transparent hover:bg-muted/80 transition-colors focus:ring-0">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {isLoadingCategories ? (
                          <SelectItem value="loading" disabled>Loading...</SelectItem>
                        ) : (currentTab === 'expense' ? expenseCategories : incomeCategories).length === 0 ? (
                          <SelectItem value="no-cat" disabled>No categories found</SelectItem>
                        ) : (
                          (currentTab === 'expense' ? expenseCategories : incomeCategories).map(category => (
                            <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Target Amount</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                      <Input
                        id="amount" type="number" step="0.01" min="0"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={isOverallLoading || isSubmittingBudget}
                        className="pl-8 h-12 rounded-xl bg-muted/50 border-transparent hover:bg-muted/80 transition-colors focus-visible:ring-0 text-lg font-bold"
                      />
                    </div>
                    {currentTab === 'expense' && selectedCategory && suggestedAmount !== null && (
                      <Button
                        type="button" variant="ghost" size="sm"
                        onClick={applySuggestion}
                        className="w-full justify-start h-8 px-2 text-xs text-muted-foreground hover:text-primary -ml-2"
                      >
                        <Lightbulb className="h-3 w-3 mr-1.5" />
                        Suggestion based on avg: {formatCurrency(suggestedAmount)}
                      </Button>
                    )}
                  </div>

                  <Button
                    onClick={handleSetOrUpdateBudget}
                    disabled={!selectedCategoryId || !newAmount || isOverallLoading || isSubmittingBudget}
                    className="w-full h-12 rounded-xl font-bold text-base mt-2 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
                  >
                    {isSubmittingBudget ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlusCircle className="h-5 w-5 mr-2" />}
                    {isSubmittingBudget ? 'Saving...' : 'Save Rule'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* === Right: List Content === */}
            <div className="lg:col-span-8">
              <TabsContent value="expense" className="mt-0 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold tracking-tight">Expense Limits</h3>
                  <Badge variant="outline" className="rounded-lg">{budgetItems.filter(b => b.type === 'expense').length} Active Rules</Badge>
                </div>
                {renderBudgetList('expense')}
              </TabsContent>
              <TabsContent value="income" className="mt-0 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold tracking-tight">Income Goals</h3>
                  <Badge variant="outline" className="rounded-lg">{budgetItems.filter(b => b.type === 'income').length} Active Goals</Badge>
                </div>
                {renderBudgetList('income')}
              </TabsContent>
            </div>
          </div>
        </Tabs>

      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Budget Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the budget for <strong>{budgetToDelete?.category}</strong>?
              <br />Existing transactions will not be deleted, but you will stop tracking against this limit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBudget} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">
              Remove Rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </DashboardLayout>
  );
};

export default BudgetPage;