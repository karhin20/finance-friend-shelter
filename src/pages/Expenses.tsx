
import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Search, ArrowUpDown, Trash2, Filter } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, formatCurrency, formatDate, Expense } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Predefined expense categories
const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Housing",
  "Transportation",
  "Entertainment",
  "Shopping",
  "Utilities",
  "Healthcare",
  "Education",
  "Personal Care",
  "Travel",
  "Gifts & Donations",
  "Business",
  "Taxes",
  "Other"
];

const ExpensesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [date, setDate] = useState<Date>(new Date());
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtering and sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Expense; direction: 'asc' | 'desc' } | null>(
    { key: 'date', direction: 'desc' }
  );

  // Delete state
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch expense data
  useEffect(() => {
    if (!user) return;

    const fetchExpenses = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false });

        if (error) throw error;
        setExpenses(data || []);
      } catch (error: any) {
        console.error('Error fetching expenses:', error.message);
        toast({
          title: 'Error',
          description: 'Failed to load expense data. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [user, toast]);

  // Add new expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !amount || !category || !date) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    // Parse amount as number and validate
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid positive number.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('expenses').insert([
        {
          user_id: user.id,
          amount: amountNum,
          category,
          date: date.toISOString(),
          description: description.trim() || null,
        },
      ]).select();

      if (error) throw error;

      // Reset form and update expense list
      setAmount('');
      setCategory('');
      setDate(new Date());
      setDescription('');
      setExpenses([...(data || []), ...expenses]);

      toast({
        title: 'Expense added',
        description: `Successfully added ${formatCurrency(amountNum)} expense.`,
      });
    } catch (error: any) {
      console.error('Error adding expense:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add expense. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete expense
  const confirmDelete = (id: string) => {
    setExpenseToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!expenseToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseToDelete);

      if (error) throw error;

      // Update expense list
      setExpenses(expenses.filter(expense => expense.id !== expenseToDelete));
      toast({
        title: 'Expense deleted',
        description: 'The expense has been successfully deleted.',
      });
    } catch (error: any) {
      console.error('Error deleting expense:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete expense. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
    }
  };

  // Filtering and sorting logic
  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = 
      expense.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      formatCurrency(expense.amount).includes(searchQuery) ||
      formatDate(expense.date).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter ? expense.category === categoryFilter : true;
    
    return matchesSearch && matchesCategory;
  });

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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">Track and manage your expenses</p>
        </div>

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
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      className="pl-8"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      step="0.01"
                      min="0.01"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory} required>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
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
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  <Plus className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Adding..." : "Add Expense"}
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
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Categories</SelectItem>
                      {uniqueCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => confirmDelete(expense.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
        {Object.keys(expensesByCategory).length > 0 && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Expenses by Category</CardTitle>
              <CardDescription>Breakdown of your spending</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(expensesByCategory).map(([category, amount]) => (
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
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ExpensesPage;
