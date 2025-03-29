import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, formatCurrency } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { PlusCircle, Trash2, AlertCircle, Edit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Housing",
  "Transportation",
  "Entertainment",
  "Shopping",
  "Utilities",
  "Internet",
  "Healthcare",
  "Education",
  "Personal Care",
  "Travel",
  "Gifts & Donations",
  "Church",
  "Business",
  "Taxes",
  "Other"
];

interface BudgetItem {
  id: string;
  category: string;
  planned_amount: number;
  actual_amount: number;
  user_id: string;
  month: string;
}

interface Expense {
  id: string;
  amount: number;
  category: string;
  date: string;
  user_id: string;
}

const BudgetPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(() => {
    const cachedBudgetItems = localStorage.getItem('budgetItems');
    return cachedBudgetItems ? JSON.parse(cachedBudgetItems) : [];
  });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null); // Track which budget is being edited

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        
        // Fetch budget items
        const { data: budgetData, error: budgetError } = await supabase
          .from('budgets')
          .select('*')
          .eq('user_id', user.id)
          .eq('month', selectedMonth);

        if (budgetError) throw budgetError;

        setBudgetItems(budgetData || []);
        localStorage.setItem('budgetItems', JSON.stringify(budgetData || [])); // Cache budget items

        // Fetch expenses for the selected month
        const startDate = new Date(selectedMonth + '-01');
        const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

        const { data: monthExpenses, error: monthExpError } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startDate.toISOString())
          .lte('date', endDate.toISOString());

        if (monthExpError) throw monthExpError;
        setExpenses(monthExpenses || []);

      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load budget data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, selectedMonth, toast]);

  // Calculate actual and remaining amounts for a category
  const getCategoryAmounts = (category: string) => {
    const actualAmount = expenses
      .filter(exp => exp.category === category)
      .reduce((sum, exp) => sum + exp.amount, 0);
    
    const budgetItem = budgetItems.find(item => item.category === category);
    const plannedAmount = budgetItem?.planned_amount || 0;
    const remainingAmount = plannedAmount - actualAmount;

    return {
      actual: actualAmount,
      remaining: remainingAmount,
      planned: plannedAmount
    };
  };

  // Modified to update or create budget item
  const addBudgetItem = async () => {
    if (!user || !selectedCategory || !newAmount) return;

    try {
      const existingBudget = budgetItems.find(item => 
        item.category === selectedCategory && item.month === selectedMonth
      );

      const { actual: actualAmount } = getCategoryAmounts(selectedCategory);
      const plannedAmount = parseFloat(newAmount);

      const newItem = {
        category: selectedCategory,
        planned_amount: plannedAmount,
        actual_amount: actualAmount,
        user_id: user.id,
        month: selectedMonth,
      };

      if (existingBudget) {
        // Check if the existing budget has a temporary ID
        if (existingBudget.id.startsWith('temp-')) {
          // Create a new budget item instead of updating the temp one
          const { data, error } = await supabase
            .from('budgets')
            .insert([newItem])
            .select();

          if (error) throw error;

          // Update the budget items, replacing the temp item with the new one
          setBudgetItems(prev => prev.map(item => 
            (item.id === existingBudget.id) ? (data[0] || item) : item
          ));
        } else {
          // Update existing budget with real ID
          const { error } = await supabase
            .from('budgets')
            .update(newItem)
            .eq('id', existingBudget.id);

          if (error) throw error;

          setBudgetItems(prev => prev.map(item => 
            (item.id === existingBudget.id) ? { ...item, ...newItem } : item
          ));
        }
      } else {
        // Create new budget
        const { data, error } = await supabase
          .from('budgets')
          .insert([newItem])
          .select();

        if (error) throw error;

        // Add the new budget item to the state
        setBudgetItems(prev => [...prev, ...(data || [])]);
      }

      setSelectedCategory('');
      setNewAmount('');

      toast({
        title: 'Success',
        description: 'Budget updated successfully',
      });
    } catch (error) {
      console.error('Error updating budget:', error);
      toast({
        title: 'Error',
        description: 'Failed to update budget',
        variant: 'destructive',
      });
    }
  };

  // Function to handle editing budget amount
  const handleEditBudget = (budgetItem: BudgetItem) => {
    setEditingBudgetId(budgetItem.id);
    setSelectedCategory(budgetItem.category);
    setNewAmount(budgetItem.planned_amount.toString());
  };

  // Function to save edited budget amount
  const saveEditedBudget = async () => {
    if (!editingBudgetId || !newAmount) return;

    try {
      const plannedAmount = parseFloat(newAmount);
      const updatedItem = {
        planned_amount: plannedAmount,
      };

      const { error } = await supabase
        .from('budgets')
        .update(updatedItem)
        .eq('id', editingBudgetId);

      if (error) throw error;

      setBudgetItems(budgetItems.map(item => 
        item.id === editingBudgetId ? { ...item, planned_amount: plannedAmount } : item
      ));

      setEditingBudgetId(null);
      setSelectedCategory('');
      setNewAmount('');

      toast({
        title: 'Success',
        description: 'Budget updated successfully',
      });
    } catch (error) {
      console.error('Error updating budget:', error);
      toast({
        title: 'Error',
        description: 'Failed to update budget',
        variant: 'destructive',
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budget Planning</h1>
          <p className="text-muted-foreground">Plan and track your monthly budget</p>
        </div>

        {/* Month selector */}
        <Card>
          <CardHeader>
            <CardTitle>Select Month</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full sm:w-[200px]"
            />
          </CardContent>
        </Card>

        {/* Add new budget item */}
        <Card>
          <CardHeader>
            <CardTitle>Set Budget Amount</CardTitle>
            <CardDescription>Set or update budget for a category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-[200px]">
                <Label htmlFor="amount">Budget Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={addBudgetItem} disabled={!selectedCategory || !newAmount}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  {budgetItems.find(item => item.category === selectedCategory)
                    ? 'Update Budget'
                    : 'Set Budget'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget items list */}
        <Card>
          <CardHeader>
            <CardTitle>Budget Overview</CardTitle>
            <CardDescription>Track your spending against budget</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {EXPENSE_CATEGORIES.map((category) => {
                const { actual: actualAmount, remaining: remainingAmount, planned: plannedAmount } = getCategoryAmounts(category);
                
                // Filter out budget items with zero planned amount
                if (plannedAmount === 0) return null;

                const percentage = plannedAmount > 0 ? (actualAmount / plannedAmount) * 100 : 0;
                const isOverBudget = remainingAmount < 0;

                return (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label>{category}</Label>
                        {isOverBudget && plannedAmount > 0 && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <Button onClick={() => {
                        const existingBudget = budgetItems.find(item => item.category === category);
                        const budgetToEdit = existingBudget || { 
                          category, 
                          planned_amount: plannedAmount, 
                          actual_amount: actualAmount,
                          id: `temp-${category}`, 
                          user_id: user?.id || '', 
                          month: selectedMonth 
                        };
                        handleEditBudget(budgetToEdit);
                      }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                    {plannedAmount > 0 ? (
                      <>
                        <Progress
                          value={Math.min(percentage, 100)}
                          className={`h-2 ${isOverBudget ? 'bg-destructive/20' : ''}`}
                        />
                        <div className="flex justify-between text-sm">
                          <span className={`text-muted-foreground ${isOverBudget ? 'text-destructive' : ''}`}>
                            Spent: {formatCurrency(actualAmount)}
                          </span>
                          <span className="text-muted-foreground">
                            Remaining: {formatCurrency(remainingAmount)}
                          </span>
                          <span className="text-muted-foreground">
                            Budget: {formatCurrency(plannedAmount)}
                          </span>
                        </div>
                        {isOverBudget && (
                          <p className="text-xs text-destructive">
                            Over budget by {formatCurrency(Math.abs(remainingAmount))}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No budget set. Current spending: {formatCurrency(actualAmount)}
                      </p>
                    )}
                  </div>
                );
              }).filter(Boolean)} {/* Filter out null values */}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default BudgetPage;