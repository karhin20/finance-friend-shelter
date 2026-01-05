import { useState, useEffect, useMemo, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, formatCurrency } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { PlusCircle, Trash2, AlertCircle, Edit, Lightbulb, Loader2, ArrowDownUp, CheckCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinance } from '@/contexts/FinanceContext';
import { Expense, Category, Income } from '@/lib/supabase';
import { isWithinInterval, startOfMonth, endOfMonth, format, subMonths } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

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

  const handleSetOrUpdateBudget = async () => {
    const categoryInfo = (currentTab === 'expense' ? expenseCategories : incomeCategories)
                         .find(c => c.id === selectedCategoryId);

    if (!user || !selectedCategoryId || !newAmount || !categoryInfo) {
        toast({ title: 'Missing Information', description: 'Please select a category and enter an amount.', variant: 'destructive'});
        return;
    }

    setIsSubmittingBudget(true);
    try {
      const plannedAmount = parseFloat(newAmount);
      if (isNaN(plannedAmount) || plannedAmount < 0) {
          toast({ title: 'Invalid Amount', description: 'Please enter a valid positive number.', variant: 'destructive'});
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

  const handleDeleteBudget = async (budgetId: string) => {
      console.log("Delete functionality not fully implemented yet for ID:", budgetId);
       toast({ title: 'Info', description: 'Delete budget item functionality not implemented.' });
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
        const remaining = planned - actual;
        const percentage = planned > 0 ? (actual / planned) * 100 : (actual > 0 ? 101 : 0);
        const isOverBudget = type === 'expense' && remaining < 0 && planned > 0;
        const isOverIncomeGoal = type === 'income' && remaining < 0 && planned > 0;

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
                                <AlertCircle className="h-4 w-4 text-destructive" title="Over budget" />
                            )}
                             {item!.isOverIncomeGoal && (
                                <CheckCircle className="h-4 w-4 text-green-600" title="Income goal met/exceeded" />
                            )}
                        </div>
                        {item!.budgetItem && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditBudget(item!.budgetItem!)}
                                disabled={isSubmittingBudget}
                                title="Edit Budget Amount"
                                className="h-6 w-6"
                            >
                                <Edit className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    {item!.planned > 0 ? (
                        <>
                            <Progress
                                value={Math.min(item!.percentage, 100)}
                                className={cn("h-2",
                                    item!.isOverBudget ? 'progress-destructive' : '',
                                    item!.isOverIncomeGoal ? 'progress-success' : ''
                                )}
                                indicatorClassName={cn(
                                   item!.isOverBudget ? 'bg-destructive' : '',
                                   item!.isOverIncomeGoal ? 'bg-green-600' : ''
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
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budget Planning</h1>
          <p className="text-muted-foreground">Plan and track your monthly income and expenses.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Month</CardTitle>
          </CardHeader>
          <CardContent>
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
              className="w-full sm:w-[200px]"
              disabled={isOverallLoading || isSubmittingBudget}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Set Budget Amount</CardTitle>
            <CardDescription>Set or update the planned amount for an income or expense category.</CardDescription>
          </CardHeader>
          <CardContent>
             <Tabs value={currentTab} onValueChange={(value) => {
                 setCurrentTab(value as 'expense' | 'income');
                 setSelectedCategory('');
                 setSelectedCategoryId('');
                 setNewAmount('');
                 setSuggestedAmount(null);
             }} className="mb-4">
                <TabsList>
                    <TabsTrigger value="expense">Expenses</TabsTrigger>
                    <TabsTrigger value="income">Income</TabsTrigger>
                </TabsList>
            </Tabs>

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
                  < SelectTrigger id="category">
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
                    className="w-full xs:w-[150px]"
                  />
                  {currentTab === 'expense' && selectedCategory && suggestedAmount !== null && (
                    <Button
                      type="button" variant="outline" size="sm"
                      onClick={applySuggestion}
                      title={`Apply suggested amount: ${formatCurrency(suggestedAmount)}`}
                      className="whitespace-nowrap h-10"
                      disabled={isSubmittingBudget}
                    >
                      <Lightbulb className="h-4 w-4 mr-1 sm:mr-2"/>
                      <span className="hidden sm:inline">Suggest:</span>
                      {formatCurrency(suggestedAmount)}
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
                  {isSubmittingBudget ? 'Saving...' : (budgetItems.find(item => item.category_id === selectedCategoryId && item.month === selectedMonth) ? 'Update Budget' : 'Set Budget')}
                </Button>
              </div>
            </div>
            {currentTab === 'expense' && selectedCategory && suggestedAmount !== null && (
              <p className="text-xs text-muted-foreground mt-2 pl-1">
                Suggestion based on average spending over the last 3 months.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Budget for {format(new Date(selectedMonth + '-02'), 'MMMM yyyy')}</CardTitle>
            <CardDescription>Track your actual income and spending against your planned budget.</CardDescription>
          </CardHeader>
          <CardContent>
             <Tabs defaultValue="expense" className="w-full">
                < TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="expense">Expense Budget</TabsTrigger>
                    <TabsTrigger value="income">Income Budget</TabsTrigger>
                </TabsList>
                < TabsContent value="expense" className="mt-4">
                    {renderBudgetList('expense')}
                </TabsContent>
                < TabsContent value="income" className="mt-4">
                    {renderBudgetList('income')}
                </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default BudgetPage;