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
import { IncomeForm } from '@/components/forms/IncomeForm';

const IncomePage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const {
    incomeQuery,
    categoriesQuery,
    addIncomeMutation, // Keep if needed for other things, or remove if unused (edit uses update)
    updateIncomeMutation,
    deleteIncomeMutation,
  } = useFinance();

  const { data: income = [], isLoading: isIncomeLoading, isError: isIncomeError, error: incomeError } = incomeQuery;
  const { data: allCategories = [], isLoading: isLoadingCategories } = categoriesQuery;

  const navigate = useNavigate();

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

  return (
    <DashboardLayout>
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Income Form */}
          <Card className="lg:col-span-1 shadow-sm">
            <CardHeader>
              <CardTitle>Add New Income</CardTitle>
              <CardDescription>
                Record a new income transaction
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncomeForm />
            </CardContent>
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
