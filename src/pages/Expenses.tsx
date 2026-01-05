import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Search, ArrowUpDown, Trash2, Filter, Pencil, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useFinance } from '@/contexts/FinanceContext';
import { Expense, formatCurrency, formatDate, Category } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Settings as SettingsIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { addWeeks, addMonths, addYears, startOfWeek, startOfMonth, isWithinInterval } from 'date-fns';

const calculateNextOccurrence = (startDate: Date, frequency: 'weekly' | 'monthly' | 'yearly'): Date => {
  switch (frequency) {
    case 'weekly':
      return addWeeks(startDate, 1);
    case 'monthly':
      return addMonths(startDate, 1);
    case 'yearly':
      return addYears(startDate, 1);
    default:
      // Should not happen with type safety
      console.warn("Invalid frequency provided to calculateNextOccurrence");
      return startDate;
  }
};

const ExpensesPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const {
    expensesQuery,
    addExpenseMutation,
    updateExpenseMutation,
    deleteExpenseMutation,
    categoriesQuery
  } = useFinance();

  const { data: expenses = [], isLoading: isExpensesLoading, isError: isExpensesError, error: expensesError } = expensesQuery;
  const { data: allCategories = [], isLoading: isLoadingCategories } = categoriesQuery;

  // Filter categories for expense type
  const expenseCategories = useMemo(() => allCategories.filter(c => c.type === 'expense'), [allCategories]);

  // Form state
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [date, setDate] = useState<Date>(new Date());
  const [description, setDescription] = useState<string>('');

  // Add recurring state
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [createInitialTransaction, setCreateInitialTransaction] = useState(true);

  // Filtering and sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Expense; direction: 'asc' | 'desc' } | null>(
    { key: 'date', direction: 'desc' }
  );

  // Delete state
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editDescription, setEditDescription] = useState('');

  // +++ ADDED: Local state for timeframe filtering +++
  const [localTimeframe, setLocalTimeframe] = useState<'week' | 'month' | 'all'>('all');

  // Filtering and sorting logic
  const filteredExpenses = useMemo(() => {
    let filtered = expenses.filter(expense => {
    const matchesSearch = 
      expense.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      formatCurrency(expense.amount).includes(searchQuery) ||
      formatDate(expense.date).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter ? expense.category === categoryFilter : true;
    
    return matchesSearch && matchesCategory;
  });

    const today = new Date();
    const startOfWeekDate = startOfWeek(today, { weekStartsOn: 0 });
    const startOfMonthDate = startOfMonth(today);

    if (localTimeframe === 'week') {
      filtered = filtered.filter(item => isWithinInterval(new Date(item.date), { start: startOfWeekDate, end: today }));
    } else if (localTimeframe === 'month') {
      filtered = filtered.filter(item => isWithinInterval(new Date(item.date), { start: startOfMonthDate, end: today }));
    }

    return filtered;
  }, [expenses, searchQuery, categoryFilter, localTimeframe]);

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    if (!sortConfig) return 0;
    
    const { key, direction } = sortConfig;
    
    if (key === 'date') {
      return direction === 'asc' 
        ? new Date(a[key]).getTime() - new Date(b[key]).getTime()
        : new Date(b[key]).getTime() - new Date(a[key]).getTime();
    }
    
    if (key === 'amount') {
      return direction === 'asc' ? a[key] - b[key] : b[key] - a[key];
    }
    
    // Handle string comparison (category, description)
    const aValue = (a[key] || '').toString();
    const bValue = (b[key] || '').toString();
    return direction === 'asc' 
      ? aValue.localeCompare(bValue)
      : bValue.localeCompare(aValue);
  });

  const requestSort = (key: keyof Expense) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Get unique categories from expenses
  const uniqueCategories = [...new Set(expenses.map(expense => expense.category))];

  // Calculate total expenses and by category
  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const expensesByCategory = filteredExpenses.reduce((acc: { [key: string]: number }, expense) => {
    if (!acc[expense.category]) {
      acc[expense.category] = 0;
    }
    acc[expense.category] += expense.amount;
    return acc;
  }, {});

  // Update unique categories for filtering dropdown based on fetched expense categories
  const uniqueCategoriesForFilter = useMemo(() =>
      [...new Set(expenseCategories.map(cat => cat.name))]
  , [expenseCategories]);

  // Add a function to open the edit dialog
  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense);
    setEditAmount(expense.amount.toString());
    setEditCategory(expense.category);
    setEditDate(new Date(expense.date));
    setEditDescription(expense.description || '');
    setEditDialogOpen(true);
  };

  // Add a function to handle the edit submission
  const handleEditExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingExpense || !editCategory) return;
    
    // Validate the amount
    const amountNum = parseFloat(editAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid positive number.',
        variant: 'destructive',
      });
      return;
    }
    
    updateExpenseMutation.mutate({
      id: editingExpense.id,
      updates: {
        amount: amountNum,
        category: editCategory,
        date: editDate.toISOString(),
        description: editDescription.trim() || null
      }
    }, {
      onSuccess: () => {
        setEditDialogOpen(false);
        toast({
          title: 'Success',
          description: 'Your expense has been updated successfully.',
        });
      },
      onError: (error) => {
        console.error('Error updating expense:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to update expense. Please try again.',
          variant: 'destructive',
        });
      }
    });
  };

  const confirmDelete = (id: string) => {
    setExpenseToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!expenseToDelete) return;
    
    deleteExpenseMutation.mutate(expenseToDelete, {
      onSuccess: () => {
        toast({
          title: 'Expense deleted',
          description: 'Your expense has been deleted successfully.',
        });
        setDeleteDialogOpen(false);
        setExpenseToDelete(null);
      },
      onError: (error) => {
        console.error('Error deleting expense:', error);
        toast({
          title: 'Error Deleting',
          description: error instanceof Error ? error.message : 'Failed to delete expense. Please try again.',
          variant: 'destructive',
        });
      }
    });
  };

  // --- Handle Add Expense ---
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation
    if (!amount || !date || !category || !user) {
       toast({ title: "Missing Fields", description: "Amount, Date, and Category are required.", variant: "destructive" });
       return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
       toast({ title: "Invalid Amount", description: "Please enter a valid positive amount.", variant: "destructive" });
       return;
    }

    if (isRecurring) {
      // Determine the correct next_due_date
      const startDateForRule = date; // The date selected in the form
      const nextDueDateForDb = createInitialTransaction
        ? calculateNextOccurrence(startDateForRule, frequency) // Calculate next occurrence if adding initial
        : startDateForRule; // Otherwise, the first due date is the start date

      // 1. Create the Recurring Rule
      try {
        const { error: recurringError } = await supabase.from('recurring_transactions').insert([{
          user_id: user.id,
          type: 'expense',
          amount: amountNum,
          category: category,
          description: description.trim() || null,
          frequency: frequency,
          start_date: format(startDateForRule, 'yyyy-MM-dd'), // Use the selected date
          next_due_date: format(nextDueDateForDb, 'yyyy-MM-dd'), // Use the calculated date
          is_active: true
        }]);
        if (recurringError) throw recurringError;

        toast({ title: "Recurring Expense Rule Saved", description: `Will add ${formatCurrency(amountNum)} ${frequency}.` });

        // 2. Optionally Add the Initial Transaction (using the selected date)
        if (createInitialTransaction) {
          addExpenseMutation.mutate({
            amount: amountNum,
            date: startDateForRule.toISOString(), // Use the selected date for the initial transaction
            category: category,
            description: description.trim() || null,
          }, {
            onSuccess: () => {
              toast({ title: "Initial Expense Added", description: "First transaction recorded." });
              // Reset form only after both potentially succeed
              setAmount(''); setDate(new Date()); setCategory(''); setDescription(''); setIsRecurring(false); setFrequency('monthly'); setCreateInitialTransaction(true);
            },
            onError: (error) => {
              console.error("Error adding initial expense:", error);
              toast({ title: "Error Adding Initial Expense", description: `Recurring rule saved, but failed to add initial transaction: ${error.message}`, variant: "destructive" });
              // Reset form partially? Or leave as is? Consider UX.
              setAmount(''); setDate(new Date()); setCategory(''); setDescription(''); setIsRecurring(false); setFrequency('monthly'); setCreateInitialTransaction(true);
            }
          });
          } else {
           // Reset form if only rule was created
           setAmount(''); setDate(new Date()); setCategory(''); setDescription(''); setIsRecurring(false); setFrequency('monthly'); setCreateInitialTransaction(true);
        }

      } catch (error: any) {
        console.error("Error saving recurring expense:", error);
        toast({ title: "Error Saving Rule", description: `Failed to save recurring rule: ${error.message}`, variant: "destructive" });
      }
    } else {
      // --- Add Single Expense Transaction ---
      addExpenseMutation.mutate({
        amount: amountNum,
        date: date.toISOString(), // Use the selected date
        category: category,
        description: description.trim() || null,
      }, {
        onSuccess: () => {
          setAmount(''); setDate(new Date()); setCategory(''); setDescription(''); setIsRecurring(false); setFrequency('monthly'); setCreateInitialTransaction(true); // Reset all form fields
          toast({ title: "Expense Added", description: "Your expense has been recorded." });
        },
        onError: (error) => {
          console.error("Error adding expense:", error);
          toast({ title: "Error", description: `Failed to add expense: ${error.message}`, variant: "destructive" });
        }
      });
    }
  };

  // Determine Button Text
  const getButtonText = () => {
    if (addExpenseMutation.isLoading || updateExpenseMutation.isLoading) {
      return "Saving...";
    }
    if (isRecurring) {
      return createInitialTransaction ? "Save Rule & Add Initial" : "Save Recurring Rule";
    }
    return "Add Expense";
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">Track and manage your expenses</p>
        </div>

        {/* === Onboarding Alert === */}
        {!isLoadingCategories && expenseCategories.length === 0 && (
          <Alert variant="default" className="bg-blue-50 border border-blue-200 text-blue-800">
            <SettingsIcon className="h-4 w-4 !text-blue-600" />
            <AlertTitle className="text-blue-900 font-semibold">Set Up Your Expense Categories!</AlertTitle>
            <AlertDescription>
              You haven't added any expense categories yet. Go to{' '}
              <Link to="/settings" className="font-medium underline hover:text-blue-900">
                Settings &gt; Categories
              </Link>
              {' '}to create categories like "Rent", "Food", etc., before adding expenses.
            </AlertDescription>
          </Alert>
        )}
        {/* === End Onboarding Alert === */}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Expense Form */}
          <Card className="lg:col-span-1 shadow-sm">
            <form onSubmit={handleAddExpense}>
              <CardHeader>
                <CardTitle>Add New Expense</CardTitle>
                <CardDescription>
                  Record a new expense transaction
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory} required disabled={isLoadingCategories || expenseCategories.length === 0}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder={
                        isLoadingCategories ? "Loading..." :
                        expenseCategories.length === 0 ? "Add categories in Settings" :
                        "Select category"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {!isLoadingCategories && expenseCategories.length > 0 && (
                        expenseCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.name}
                        </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        id="date"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(date) => date && setDate(date)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="e.g., Grocery shopping, Restaurant bill"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {/* === Add Recurring Options === */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="recurring-expense"
                      checked={isRecurring}
                      onCheckedChange={(checked) => {
                          setIsRecurring(checked === true);
                          // Reset createInitialTransaction when unchecking recurring
                          if (checked !== true) setCreateInitialTransaction(true);
                      }}
                      disabled={expenseCategories.length === 0} // Disable if no categories
                    />
                    <Label htmlFor="recurring-expense" className="font-medium">Set as Recurring Expense?</Label>
                  </div>

                  {isRecurring && (
                    <div className="space-y-4 pl-6 pt-2">
                      {/* Frequency Select */}
                      <div>
                          <Label htmlFor="frequency-expense">Frequency</Label>
                          <Select value={frequency} onValueChange={(v: any) => setFrequency(v)} required={isRecurring}>
                            <SelectTrigger id="frequency-expense">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="yearly">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            Starts on the selected date ({format(date, "PPP")}).
                          </p>
                      </div>
                      {/* New Checkbox for Initial Transaction */}
                      <div className="flex items-center space-x-2">
                          <Checkbox
                            id="create-initial-expense"
                            checked={createInitialTransaction}
                            onCheckedChange={(checked) => setCreateInitialTransaction(checked === true)}
                          />
                          <Label htmlFor="create-initial-expense" className="text-sm font-normal">Add first transaction now?</Label>
                      </div>
                    </div>
                  )}
                </div>
                {/* === End Recurring Options === */}

              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={addExpenseMutation.isLoading || expenseCategories.length === 0}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {getButtonText()}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Expenses List */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <div className="flex flex-col space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Expense History</CardTitle>
                    <CardDescription>
                      Total: {formatCurrency(totalExpenses)}
                    </CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search expenses..."
                      className="pl-10 w-full sm:w-[250px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                
                {/* Category filter */}
                <div className="flex items-center">
                  <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                  <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={isLoadingCategories}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {uniqueCategoriesForFilter.map((catName) => (
                        <SelectItem key={catName} value={catName || "uncategorized"}>
                          {catName || "Uncategorized"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* +++ ADDED: Timeframe filter buttons +++ */}
              <div className="flex space-x-2 mt-4">
                <Button
                  variant={localTimeframe === 'week' ? 'default' : 'outline'}
                  onClick={() => setLocalTimeframe('week')}
                  size="sm"
                >
                  This Week
                </Button>
                <Button
                  variant={localTimeframe === 'month' ? 'default' : 'outline'}
                  onClick={() => setLocalTimeframe('month')}
                  size="sm"
                >
                  This Month
                </Button>
                <Button
                  variant={localTimeframe === 'all' ? 'default' : 'outline'}
                  onClick={() => setLocalTimeframe('all')}
                  size="sm"
                >
                  All Time
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isExpensesLoading ? (
                <div className="space-y-4 animate-pulse">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex justify-between p-2">
                      <div className="h-6 w-24 bg-muted rounded"></div>
                      <div className="h-6 w-20 bg-muted rounded"></div>
                    </div>
                  ))}
                </div>
              ) : isExpensesError ? (
                <div className="text-center py-12 text-destructive">
                  <p>Error loading expenses: {expensesError?.message || 'Unknown error'}</p>
                </div>
              ) : sortedExpenses.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => requestSort('date')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Date</span>
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => requestSort('amount')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Amount</span>
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => requestSort('category')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Category</span>
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => requestSort('description')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Description</span>
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedExpenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell className="font-medium">{formatDate(expense.date)}</TableCell>
                          <TableCell className="text-expense">{formatCurrency(expense.amount)}</TableCell>
                          <TableCell>
                            <span className="inline-block px-2 py-1 rounded-full bg-muted text-xs font-medium">
                              {expense.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {expense.description || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => openEditDialog(expense)}
                                className="text-muted-foreground hover:text-primary"
                                title="Edit"
                                disabled={updateExpenseMutation.isLoading || deleteExpenseMutation.isLoading}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => confirmDelete(expense.id)}
                                className="text-muted-foreground hover:text-destructive"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-6">No expense transactions yet</p>
                  <p className="text-sm text-muted-foreground mb-4">Use the form to add your first expense entry</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Category summary */}
        {Object.keys(expensesByCategory).length > 0 && !isExpensesLoading && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Expenses by Category</CardTitle>
              <CardDescription>Breakdown of your spending</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a).map(([category, amount]) => (
                  <div key={category} className="flex items-center justify-between p-3 rounded-lg border">
                    <span className="font-medium">{category}</span>
                    <span className="text-expense">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertDescription>
              Deleting this expense will permanently remove it from your records.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteExpenseMutation.isLoading}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleteExpenseMutation.isLoading}
            >
              {deleteExpenseMutation.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>
              Update expense transaction details.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={(e) => { e.preventDefault(); handleEditExpense(e); }} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="editAmount">Amount</Label>
              <Input
                id="editAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="editCategory">Category</Label>
              <Select value={editCategory} onValueChange={setEditCategory} required>
                <SelectTrigger id="editCategory" disabled={isLoadingCategories}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingCategories ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem >
                  ) : (
                    expenseCategories.map((cat) => (
                      <SelectItem key={`edit-${cat.id}`} value={cat.name}>
                        {cat.name}
                    </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="editDate">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    id="editDate"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editDate ? format(editDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editDate}
                    onSelect={(date) => date && setEditDate(date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="editDescription">Description (Optional)</Label>
              <Textarea
                id="editDescription"
                placeholder="e.g., Grocery shopping, Restaurant bill"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setEditDialogOpen(false)}
                type="button"
                disabled={updateExpenseMutation.isLoading}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={updateExpenseMutation.isLoading}
              >
                {updateExpenseMutation.isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ExpensesPage;
