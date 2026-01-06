import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Search, ArrowUpDown, Pencil, Trash2, AlertCircle, Settings as SettingsIcon, Loader2, Wallet, TrendingUp, TrendingDown, DollarSign, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useFinance } from '@/contexts/FinanceContext';
import { supabase, Income, formatDate, Category } from '@/lib/supabase';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useNavigate, Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { addWeeks, addMonths, addYears, startOfWeek, startOfMonth, isWithinInterval } from 'date-fns';

// Helper function (place inside or outside the component)
const calculateNextOccurrence = (startDate: Date, frequency: 'weekly' | 'monthly' | 'yearly'): Date => {
  switch (frequency) {
    case 'weekly':
      return addWeeks(startDate, 1);
    case 'monthly':
      return addMonths(startDate, 1);
    case 'yearly':
      return addYears(startDate, 1);
    default:
      console.warn("Invalid frequency provided to calculateNextOccurrence");
      return startDate;
  }
};

const IncomePage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const {
    incomeQuery,
    categoriesQuery,
    addIncomeMutation,
    updateIncomeMutation,
    deleteIncomeMutation,
    addDefaultCategoriesMutation
  } = useFinance();

  const { data: income = [], isLoading: isIncomeLoading, isError: isIncomeError, error: incomeError } = incomeQuery;
  const { data: allCategories = [], isLoading: isLoadingCategories } = categoriesQuery;

  const navigate = useNavigate();

  // Form state
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<Date>(new Date());
  const [source, setSource] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Filtering and sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Income; direction: 'asc' | 'desc' } | null>(
    { key: 'date', direction: 'desc' }
  );

  // Add new state variables for editing
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editSource, setEditSource] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Add recurring options to the income form
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [createInitialTransaction, setCreateInitialTransaction] = useState(true);

  // Add state variables for delete functionality (near the top of the component where other states are defined)
  const [incomeToDelete, setIncomeToDelete] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // +++ ADDED: Local state for timeframe filtering +++
  const [localTimeframe, setLocalTimeframe] = useState<'week' | 'month' | 'all'>('all');

  // Mobile Card View Toggle State
  const [activeMobileItem, setActiveMobileItem] = useState<string | null>(null);
  const toggleMobileItem = (id: string) => {
    setActiveMobileItem(prev => prev === id ? null : id);
  };

  // Filtering and sorting logic
  const filteredIncome = useMemo(() => {
    let filtered = income.filter(item =>
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      formatCurrency(item.amount).includes(searchQuery) ||
      formatDate(item.date).toLowerCase().includes(searchQuery.toLowerCase())
    );

    const today = new Date();
    const startOfWeekDate = startOfWeek(today, { weekStartsOn: 0 });
    const startOfMonthDate = startOfMonth(today);

    if (localTimeframe === 'week') {
      filtered = filtered.filter(item => isWithinInterval(new Date(item.date), { start: startOfWeekDate, end: today }));
    } else if (localTimeframe === 'month') {
      filtered = filtered.filter(item => isWithinInterval(new Date(item.date), { start: startOfMonthDate, end: today }));
    }

    return filtered;
  }, [income, searchQuery, localTimeframe]);

  const sortedIncome = [...filteredIncome].sort((a, b) => {
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

    // Handle string comparison (description)
    const aValue = (a[key] || '').toString();
    const bValue = (b[key] || '').toString();
    return direction === 'asc'
      ? aValue.localeCompare(bValue)
      : bValue.localeCompare(aValue);
  });

  const requestSort = (key: keyof Income) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Calculate total income
  const totalIncome = filteredIncome.reduce((sum, item) => sum + item.amount, 0);

  // Filter categories for income type
  const incomeCategories = useMemo(() => allCategories.filter(c => c.type === 'income'), [allCategories]);

  // Update unique categories for filtering dropdown based on fetched income categories
  const uniqueCategoriesForFilter = useMemo(() =>
    [...new Set(incomeCategories.map((cat: Category) => cat.name))]
    , [incomeCategories]);

  // Add a function to open the edit dialog
  const openEditDialog = (income: Income) => {
    setEditingIncome(income);
    setEditAmount(income.amount.toString());
    setEditDate(new Date(income.date));
    setEditSource(income.category || '');
    setEditDescription(income.description || '');
    setEditDialogOpen(true);
  };

  // Add a function to handle the edit submission
  const handleEditIncome = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingIncome || !editSource) return;

    // Validate the amount
    const amountNum = parseFloat(editAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid positive amount.", variant: "destructive" });
      return;
    }

    // Find the category ID based on the selected name
    const selectedCategory = incomeCategories.find(cat => cat.name === editSource);
    if (!selectedCategory) {
      toast({ title: "Category Error", description: "Selected category not found.", variant: "destructive" });
      return;
    }

    updateIncomeMutation.mutate({
      id: editingIncome.id,
      updates: {
        amount: amountNum,
        date: editDate.toISOString(),
        category: editSource,
        description: editDescription.trim() || null,
      }
    }, {
      onSuccess: () => {
        setEditDialogOpen(false);
        toast({ title: "Income Updated", description: "Transaction details saved." });
      },
      onError: (error) => {
        console.error("Error updating income:", error);
        toast({ title: "Error", description: `Failed to update income: ${error.message}`, variant: "destructive" });
      }
    });
  };

  // Add function to open the delete confirmation dialog
  const confirmDelete = (id: string) => {
    setIncomeToDelete(id);
    setDeleteDialogOpen(true);
  };

  // Add function to handle the actual delete operation
  const handleDelete = async () => {
    if (!incomeToDelete) return;
    deleteIncomeMutation.mutate(incomeToDelete, {
      onSuccess: () => {
        toast({ title: "Income Deleted", description: "Transaction removed." });
        setDeleteDialogOpen(false);
        setIncomeToDelete(null);
      },
      onError: (error) => {
        toast({ title: "Error Deleting", description: `Failed to delete: ${error.message}`, variant: "destructive" });
      }
    });
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation
    if (!amount || !date || !source || !user) {
      toast({ title: "Missing Fields", description: "Amount, Date, Source, and User are required.", variant: "destructive" });
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid positive amount.", variant: "destructive" });
      return;
    }

    const selectedCategory = incomeCategories.find(cat => cat.name === source);
    if (!selectedCategory) {
      toast({ title: "Category Error", description: "Selected category not found.", variant: "destructive" });
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
          type: 'income',
          amount: amountNum,
          category: source,
          description: description.trim() || null,
          frequency: frequency,
          start_date: format(startDateForRule, 'yyyy-MM-dd'), // Use the selected date
          next_due_date: format(nextDueDateForDb, 'yyyy-MM-dd'), // Use the calculated date
          is_active: true
        }]);
        if (recurringError) throw recurringError;

        toast({ title: "Recurring Income Rule Saved", description: `Will add ${formatCurrency(amountNum)} ${frequency}.` });

        // 2. Optionally Add the Initial Transaction (using the selected date)
        if (createInitialTransaction) {
          addIncomeMutation.mutate({
            amount: amountNum,
            date: startDateForRule.toISOString(), // Use the selected date for the initial transaction
            category: source,
            description: description.trim() || null,
          }, {
            onSuccess: () => {
              toast({ title: "Initial Income Added", description: "First transaction recorded." });
              // Reset form only after both potentially succeed
              setAmount(''); setDate(new Date()); setSource(''); setDescription(''); setIsRecurring(false); setFrequency('monthly'); setCreateInitialTransaction(true);
            },
            onError: (error) => {
              console.error("Error adding initial income:", error);
              toast({ title: "Error Adding Initial Income", description: `Recurring rule saved, but failed to add initial transaction: ${error.message}`, variant: "destructive" });
              // Reset form partially? Or leave as is? Consider UX.
              setAmount(''); setDate(new Date()); setSource(''); setDescription(''); setIsRecurring(false); setFrequency('monthly'); setCreateInitialTransaction(true);
            }
          });
        } else {
          // Reset form if only rule was created
          setAmount(''); setDate(new Date()); setSource(''); setDescription(''); setIsRecurring(false); setFrequency('monthly'); setCreateInitialTransaction(true);
        }

      } catch (error: any) {
        console.error("Error saving recurring income:", error);
        toast({ title: "Error Saving Rule", description: `Failed to save recurring rule: ${error.message}`, variant: "destructive" });
      }
    } else {
      // --- Add Single Income Transaction ---
      addIncomeMutation.mutate({
        amount: amountNum,
        date: date.toISOString(), // Use the selected date
        category: source,
        description: description.trim() || null,
      }, {
        onSuccess: () => {
          setAmount(''); setDate(new Date()); setSource(''); setDescription(''); setIsRecurring(false); setFrequency('monthly'); setCreateInitialTransaction(true); // Reset all form fields
          toast({ title: "Income Added", description: "Your income has been recorded." });
        },
        onError: (error) => {
          console.error("Error adding income:", error);
          toast({ title: "Error", description: `Failed to add income: ${error.message}`, variant: "destructive" });
        }
      });
    }
  };

  // Determine Button Text
  const getButtonText = () => {
    if (addIncomeMutation.isLoading || updateIncomeMutation.isLoading) {
      return "Saving...";
    }
    if (isRecurring) {
      return createInitialTransaction ? "Save Rule & Add Initial" : "Save Recurring Rule";
    }
    return "Add Income";
  };

  return (
    <DashboardLayout>
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Income Form */}
          <Card className="lg:col-span-1 shadow-sm">
            <form onSubmit={handleAddIncome}>
              <CardHeader>
                <CardTitle>Add New Income</CardTitle>
                <CardDescription>
                  Record a new income transaction
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quick Suggestions */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Suggestions</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Salary', category: 'Salary', icon: '💼', color: 'text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-200' },
                      { label: 'Freelance', category: 'Freelance', icon: '💻', color: 'text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 border-blue-200' },
                      { label: 'Gifts', category: 'Gifts', icon: '🎁', color: 'text-pink-500 bg-pink-500/10 hover:bg-pink-500/20 border-pink-200' },
                      { label: 'Interest', category: 'Interest', icon: '📈', color: 'text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 border-amber-200' },
                      { label: 'Dividend', category: 'Investment', icon: '💰', color: 'text-purple-600 bg-purple-500/10 hover:bg-purple-500/20 border-purple-200' },
                    ].map((suggestion) => (
                      <Button
                        key={suggestion.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn("h-7 text-xs px-2.5 py-0.5 rounded-full transition-colors border", suggestion.color)}
                        onClick={() => {
                          setDescription(suggestion.label);
                          // Try to find the category/source in the user's categories
                          const foundCat = incomeCategories.find(c =>
                            c.name.toLowerCase() === suggestion.category.toLowerCase() ||
                            c.name.toLowerCase().includes(suggestion.label.toLowerCase())
                          );
                          if (foundCat) {
                            setSource(foundCat.name);
                          }
                        }}
                      >
                        <span className="mr-1.5">{suggestion.icon}</span>
                        {suggestion.label}
                      </Button>
                    ))}
                  </div>
                </div>
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
                  <Label htmlFor="source">Source/Category</Label>
                  <Select
                    value={source}
                    onValueChange={setSource}
                    required
                    disabled={isLoadingCategories || incomeCategories.length === 0}
                  >
                    <SelectTrigger id="source">
                      <SelectValue placeholder={
                        isLoadingCategories ? "Loading..." :
                          incomeCategories.length === 0 ? "Add categories in Settings" :
                            "Select source"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {!isLoadingCategories && incomeCategories.length > 0 && (
                        incomeCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="e.g., Salary, Freelance work, Gift"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="recurring-income"
                      checked={isRecurring}
                      onCheckedChange={(checked) => {
                        setIsRecurring(checked === true);
                        // Reset createInitialTransaction when unchecking recurring
                        if (checked !== true) setCreateInitialTransaction(true);
                      }}
                      disabled={incomeCategories.length === 0}
                    />
                    <Label htmlFor="recurring-income" className="font-medium">Set as Recurring Income?</Label>
                  </div>

                  {isRecurring && (
                    <div className="space-y-4 pl-6 pt-2">
                      {/* Frequency Select */}
                      <div>
                        <Label htmlFor="frequency-income">Frequency</Label>
                        <Select value={frequency} onValueChange={(v: any) => setFrequency(v)} required={isRecurring}>
                          <SelectTrigger id="frequency-income">
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
                          id="create-initial-income"
                          checked={createInitialTransaction}
                          onCheckedChange={(checked) => setCreateInitialTransaction(checked === true)}
                        />
                        <Label htmlFor="create-initial-income" className="text-sm font-normal">Add first transaction now?</Label>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={addIncomeMutation.isLoading || updateIncomeMutation.isLoading || incomeCategories.length === 0}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {getButtonText()}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Income List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary Card */}
            <Card className="shadow-sm border-primary/20 bg-primary/5">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Income</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary flex items-center">
                  <Wallet className="mr-2 h-5 w-5 opacity-75" />
                  {formatCurrency(totalIncome)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {localTimeframe === 'all' ? 'All time' : localTimeframe === 'month' ? 'This month' : 'This week'}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Income History</CardTitle>
                    <CardDescription>
                      Recent transactions
                    </CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search income..."
                      className="pl-10 w-full sm:w-[250px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
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
                {isIncomeLoading ? (
                  <div className="space-y-4 animate-pulse">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex justify-between p-2">
                        <div className="h-6 w-24 bg-muted rounded"></div>
                        <div className="h-6 w-20 bg-muted rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : isIncomeError ? (
                  <div className="text-center py-12 text-destructive flex flex-col items-center gap-2">
                    <AlertCircle className="h-6 w-6" />
                    <p className="font-semibold">Error Loading Income</p>
                    <p className="text-sm">{incomeError?.message || 'An unknown error occurred.'}</p>
                  </div>
                ) : sortedIncome.length > 0 ? (
                  <div className="rounded-md border">
                    {/* Desktop Table View */}
                    <div className="hidden md:block">
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
                                <span>Source/Category</span>
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
                            <TableHead>
                              <div className="flex items-center space-x-1">
                                <span>Actions</span>
                              </div>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedIncome.map((item) => {
                            return (
                              <TableRow key={item.id} className="group hover:bg-transparent data-[state=selected]:bg-transparent">
                                <TableCell className="font-medium">{formatDate(item.date)}</TableCell>
                                <TableCell className="text-income font-bold">{formatCurrency(item.amount)}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {item.category || "-"}
                                </TableCell>
                                <TableCell className="text-muted-foreground max-w-[200px] truncate">
                                  {item.description || "-"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openEditDialog(item)}
                                      className="h-8 w-8 hover:text-primary hover:bg-primary/10"
                                    >
                                      <Pencil className="h-4 w-4" />
                                      <span className="sr-only">Edit</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => confirmDelete(item.id)}
                                      className="h-8 w-8 hover:text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Delete</span>
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y">
                      {sortedIncome.map((item) => (
                        <div
                          key={item.id}
                          className="p-4 flex flex-col gap-3 active:bg-muted/20 transition-colors cursor-pointer"
                          onClick={() => toggleMobileItem(item.id)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <span className="font-bold text-base">{item.category || "Uncategorized"}</span>
                              <span className="text-sm text-muted-foreground">{formatDate(item.date)}</span>
                            </div>
                            <span className="font-black text-income text-lg">{formatCurrency(item.amount)}</span>
                          </div>
                          {item.description && (
                            <div className="text-sm text-muted-foreground bg-muted/30 p-2 rounded-md">
                              {item.description}
                            </div>
                          )}

                          {/* Action Buttons - Only visible when active */}
                          <div className={cn(
                            "flex justify-end gap-2 mt-1 overflow-hidden transition-all duration-300 ease-in-out",
                            activeMobileItem === item.id ? "max-h-12 opacity-100" : "max-h-0 opacity-0"
                          )}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent toggling when clicking button
                                openEditDialog(item);
                              }}
                              className="h-8 text-xs"
                              disabled={updateIncomeMutation.isLoading || deleteIncomeMutation.isLoading}
                            >
                              <Pencil className="h-3 w-3 mr-1" /> Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent toggling when clicking button
                                confirmDelete(item.id);
                              }}
                              className="h-8 text-xs"
                              disabled={updateIncomeMutation.isLoading || deleteIncomeMutation.isLoading}
                            >
                              <Trash2 className="h-3 w-3 mr-1" /> Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p>No income transactions found for the selected date range.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Income</DialogTitle>
            <DialogDescription>
              Update income transaction details.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditIncome} className="space-y-4 py-2">
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
              <Label htmlFor="editSource">Source/Category</Label>
              <Select value={editSource} onValueChange={setEditSource} required>
                <SelectTrigger id="editSource" disabled={isLoadingCategories}>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingCategories ? (<SelectItem value="loading" disabled>Loading...</SelectItem >)
                    : (incomeCategories.map((cat) => (
                      <SelectItem key={`edit-${cat.id}`} value={cat.name}>{cat.name}</SelectItem>
                    )))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editDescription">Description (Optional)</Label>
              <Textarea
                id="editDescription"
                placeholder="e.g., Salary, Freelance work, Gift"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                type="button"
                disabled={updateIncomeMutation.isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateIncomeMutation.isLoading}
              >
                {updateIncomeMutation.isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Income</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this income record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertDescription>
              Deleting this income will permanently remove it from your records.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteIncomeMutation.isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteIncomeMutation.isLoading}
            >
              {deleteIncomeMutation.isLoading ? (
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
    </DashboardLayout>
  );
};

export default IncomePage;
