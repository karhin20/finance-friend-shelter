import { useState, useEffect, useMemo, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { format, differenceInWeeks, differenceInMonths, isAfter, startOfDay } from 'date-fns';
import { CalendarIcon, Plus, PiggyBank, ArrowUpDown, Trash2, Pencil, CheckCircle, Loader2, Target, TrendingUp } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, formatDate } from '@/lib/supabase'; // Assuming these helpers exist
import { useCurrency } from '@/contexts/CurrencyContext';
import { useFinance } from '@/contexts/FinanceContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

// Define the Savings type
type Saving = {
  id: string;
  user_id: string;
  amount: number;
  goal_amount: number | null; // Allow null for goals without a specific target amount
  title: string;
  date: string; // ISO string date
  target_date?: string | null; // ISO string date or null
  description?: string | null;
  created_at: string; // Keep track of creation time
};

// Define keys that can be sorted
type SortableKeys = keyof Omit<Saving, 'user_id' | 'description'> | 'progress';

// Reusable Form Component State Type
type SavingFormData = {
  title: string;
  amount: string;
  goalAmount: string;
  date: Date;
  targetDate?: Date;
  description: string;
  deductFromBalance: boolean;
};

// --- Helper Function for Projections ---
const calculateProjections = (saving: Saving): { weekly: number | null; monthly: number | null; remainingAmount: number } => {
  const now = startOfDay(new Date());
  const targetDate = saving.target_date ? startOfDay(new Date(saving.target_date)) : null;
  const goalAmount = saving.goal_amount ?? 0;
  const currentAmount = saving.amount;
  const remainingAmount = Math.max(0, goalAmount - currentAmount);

  if (!targetDate || !isAfter(targetDate, now) || remainingAmount <= 0 || goalAmount <= 0) {
    return { weekly: null, monthly: null, remainingAmount };
  }

  const weeksRemaining = differenceInWeeks(targetDate, now);
  const monthsRemaining = differenceInMonths(targetDate, now);

  const weekly = weeksRemaining > 0 ? remainingAmount / weeksRemaining : null;
  const monthly = monthsRemaining > 0 ? remainingAmount / monthsRemaining : null;

  return { weekly, monthly, remainingAmount };
};

// --- Savings Page Component ---
const SavingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { addExpenseMutation } = useFinance();
  const [savings, setSavings] = useState<Saving[]>(() => {
    const cachedSavings = localStorage.getItem('savings');
    return cachedSavings ? JSON.parse(cachedSavings) : [];
  });
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addFundsDialogOpen, setAddFundsDialogOpen] = useState(false);

  // Item Selection States for Dialogs
  const [savingToEdit, setSavingToEdit] = useState<Saving | null>(null);
  const [savingToDelete, setSavingToDelete] = useState<Saving | null>(null);
  const [savingToAddFunds, setSavingToAddFunds] = useState<Saving | null>(null);

  // Loading States for Actions
  const [isSubmitting, setIsSubmitting] = useState(false); // For Add/Edit
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingFunds, setIsUpdatingFunds] = useState(false);

  // State for Add Funds Dialog specific input
  const [additionalAmount, setAdditionalAmount] = useState<string>('');
  const [deductFromBalanceFunds, setDeductFromBalanceFunds] = useState<boolean>(false);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'asc' | 'desc' }>({
    key: 'date', // Default sort by date saved
    direction: 'desc',
  });

  // --- Data Fetching ---
  const fetchSavings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('savings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavings(data || []);
      localStorage.setItem('savings', JSON.stringify(data || [])); // Cache savings
    } catch (error: any) {
      console.error('Error fetching savings:', error.message);
      toast({
        title: 'Error Loading Savings',
        description: 'Failed to load savings data. Please try refreshing the page.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchSavings();
  }, [fetchSavings]);

  // --- Calculations ---
  const totalSavings = useMemo(() => savings.reduce((sum, saving) => sum + saving.amount, 0), [savings]);

  const getProgress = useCallback((saving: Saving): number => {
    if (!saving.goal_amount || saving.goal_amount <= 0) return 0; // Treat no goal or zero goal as 0 progress unless amount > 0
    if (saving.amount <= 0) return 0;
    return Math.min(100, Math.max(0, (saving.amount / saving.goal_amount) * 100));
  }, []);

  // --- Sorting Logic ---
  const requestSort = (key: SortableKeys) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedSavings = useMemo(() => {
    let sortableItems = [...savings];
    sortableItems.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      const key = sortConfig.key;

      if (key === 'progress') {
        aValue = getProgress(a);
        bValue = getProgress(b);
      } else if (key === 'amount' || key === 'goal_amount') {
        // Handle null goal_amount for sorting
        aValue = a[key as keyof Saving] ?? (sortConfig.direction === 'asc' ? Infinity : -Infinity);
        bValue = b[key as keyof Saving] ?? (sortConfig.direction === 'asc' ? Infinity : -Infinity);
      } else if (key === 'date' || key === 'target_date' || key === 'created_at') {
        // Handle null target_date
        aValue = a[key as keyof Saving] ? new Date(a[key as keyof Saving]!).getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
        bValue = b[key as keyof Saving] ? new Date(b[key as keyof Saving]!).getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
      } else { // title (string comparison)
        aValue = a[key as keyof Saving] ?? '';
        bValue = b[key as keyof Saving] ?? '';
        return aValue.localeCompare(bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
      }

      // Numeric comparison (handles dates converted to timestamps too)
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return sortableItems;
  }, [savings, sortConfig, getProgress]);


  // --- CRUD Handlers ---

  // ADD Saving
  const handleAddSaving = async (formData: SavingFormData) => {
    if (!user) return;

    const amountNum = parseFloat(formData.amount);
    const goalAmountNum = formData.goalAmount ? parseFloat(formData.goalAmount) : null;

    // Basic Validation (more robust validation can be added)
    if (isNaN(amountNum) || amountNum < 0) { /* Allow 0 initial */
      toast({ title: 'Invalid Initial Amount', description: 'Please enter a valid number (0 or greater).', variant: 'destructive' }); return;
    }
    if (formData.goalAmount && (isNaN(goalAmountNum!) || goalAmountNum! <= 0)) {
      toast({ title: 'Invalid Goal Amount', description: 'Goal amount must be a positive number.', variant: 'destructive' }); return;
    }
    if (!formData.title.trim()) {
      toast({ title: 'Title Required', description: 'Please enter a title for your saving.', variant: 'destructive' }); return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('savings').insert([
        {
          user_id: user.id,
          title: formData.title.trim(),
          amount: amountNum,
          goal_amount: goalAmountNum,
          date: formData.date.toISOString(), // Date the initial amount was saved/set
          target_date: formData.targetDate ? formData.targetDate.toISOString() : null,
          description: formData.description.trim() || null,
          // created_at is handled by DB
        },
      ]).select().single(); // Use single() if expecting one row

      if (error) throw error;
      if (!data) throw new Error("Saving not created.");

      setSavings([data, ...savings]); // Add to the top

      // Handle Deduction (Expense Creation)
      if (formData.deductFromBalance && amountNum > 0) {
        addExpenseMutation.mutate({
          amount: amountNum,
          description: `Transfer to Savings: ${data.title}`,
          date: new Date().toISOString(), // Use current date for the transaction
          category: 'Savings', // Ensure 'Savings' category exists or is handled
        });
      }

      toast({ title: 'Saving Goal Added', description: `Successfully added "${data.title}".` });
      setAddDialogOpen(false); // Close dialog on success

    } catch (error: any) {
      console.error('Error adding saving:', error);
      toast({ title: 'Error Adding Saving', description: error.message || 'Failed to add saving. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // EDIT Saving
  const openEditDialog = (saving: Saving) => {
    setSavingToEdit(saving);
    setEditDialogOpen(true); // Open the parent Dialog
  };

  const handleEditSaving = async (formData: SavingFormData) => {
    if (!user || !savingToEdit) return;

    const amountNum = parseFloat(formData.amount);
    const goalAmountNum = formData.goalAmount ? parseFloat(formData.goalAmount) : null;

    // Validation similar to Add
    if (isNaN(amountNum) || amountNum < 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter a valid number (0 or greater).', variant: 'destructive' }); return;
    }
    if (formData.goalAmount && (isNaN(goalAmountNum!) || goalAmountNum! <= 0)) {
      toast({ title: 'Invalid Goal Amount', description: 'Goal amount must be a positive number.', variant: 'destructive' }); return;
    }
    if (!formData.title.trim()) {
      toast({ title: 'Title Required', description: 'Please enter a title.', variant: 'destructive' }); return;
    }

    setIsSubmitting(true); // Reuse isSubmitting state
    try {
      const { data, error } = await supabase
        .from('savings')
        .update({
          title: formData.title.trim(),
          amount: amountNum, // Allow editing the current amount directly
          goal_amount: goalAmountNum,
          date: formData.date.toISOString(), // Allow editing the 'start' date
          target_date: formData.targetDate ? formData.targetDate.toISOString() : null,
          description: formData.description.trim() || null,
        })
        .eq('id', savingToEdit.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error("Saving not updated.");

      // Update local state
      setSavings(savings.map(s => s.id === savingToEdit.id ? data : s));
      toast({ title: 'Saving Updated', description: `Successfully updated "${data.title}".` });
      setEditDialogOpen(false); // Close the parent Dialog
      setSavingToEdit(null);

    } catch (error: any) {
      console.error('Error editing saving:', error);
      toast({ title: 'Error Updating Saving', description: error.message || 'Failed to update saving.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };


  // DELETE Saving
  const confirmDelete = (saving: Saving) => {
    setSavingToDelete(saving);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSaving = async () => {
    if (!savingToDelete || !user) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('savings')
        .delete()
        .eq('id', savingToDelete.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setSavings(savings.filter(s => s.id !== savingToDelete.id));
      toast({ title: 'Saving Deleted', description: `Successfully deleted "${savingToDelete.title}".` });
      setDeleteDialogOpen(false);
      setSavingToDelete(null);

    } catch (error: any) {
      console.error('Error deleting saving:', error);
      toast({ title: 'Error Deleting Saving', description: error.message || 'Failed to delete saving.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  // ADD FUNDS to Existing Saving
  const openAddFundsDialog = (saving: Saving) => {
    setSavingToAddFunds(saving);
    setAdditionalAmount(''); // Reset input
    setDeductFromBalanceFunds(false); // Reset checkbox
    setAddFundsDialogOpen(true);
  };

  const handleAddFunds = async () => {
    if (!user || !savingToAddFunds || !additionalAmount) return;

    const amountToAdd = parseFloat(additionalAmount);
    if (isNaN(amountToAdd) || amountToAdd <= 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter a valid positive number to add.', variant: 'destructive' }); return;
    }

    setIsUpdatingFunds(true);
    try {
      const newAmount = savingToAddFunds.amount + amountToAdd;
      const { data, error } = await supabase
        .from('savings')
        .update({ amount: newAmount })
        .eq('id', savingToAddFunds.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error("Failed to update funds.");

      setSavings(savings.map(s => s.id === savingToAddFunds.id ? data : s));

      // Handle Deduction Logic for Funds
      if (deductFromBalanceFunds) {
        addExpenseMutation.mutate({
          amount: amountToAdd,
          description: `Transfer to Savings: ${savingToAddFunds.title}`,
          date: new Date().toISOString(),
          category: 'Savings',
        });
      }

      toast({ title: 'Funds Added', description: `Added ${formatCurrency(amountToAdd)} to "${savingToAddFunds.title}".` });
      setAddFundsDialogOpen(false);
      setSavingToAddFunds(null);

    } catch (error: any) {
      console.error('Error adding funds:', error);
      toast({ title: 'Error Adding Funds', description: error.message || 'Failed to add funds.', variant: 'destructive' });
    } finally {
      setIsUpdatingFunds(false);
    }
  };

  // --- Render ---
  return (
    <DashboardLayout>
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Add Button & Quick Summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="bg-muted/30 p-2 rounded-2xl border border-border/40 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <PiggyBank className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Total Saved</p>
              <p className="text-2xl font-black tracking-tight leading-none">{loading ? '...' : formatCurrency(totalSavings)}</p>
            </div>
          </div>
          {/* Add Saving Dialog Trigger & Container */}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Saving Goal
              </Button>
            </DialogTrigger>
            {/* SavingFormDialog is rendered inside when open */}
            <SavingFormDialog
              mode="add"
              onOpenChange={setAddDialogOpen} // Allows closing from within
              onSubmit={handleAddSaving}
              isSubmitting={isSubmitting}
            />
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle>Total Saved Amount</CardTitle>
              <CardDescription>Sum of current amounts across all goals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {loading ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : formatCurrency(totalSavings)}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Goal Progress Overview</CardTitle>
              <CardDescription>Quick view of active goals</CardDescription>
            </CardHeader>
            <CardContent className="max-h-48 overflow-y-auto space-y-3 pr-2"> {/* Limit height and add scroll */}
              {loading ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (<div key={i} className="animate-pulse"><div className="h-4 bg-muted rounded w-3/4 mb-1"></div><div className="h-2 bg-muted rounded w-full"></div></div>))}
                </div>
              ) : savings.some(s => s.goal_amount && s.goal_amount > 0) ? (
                savings
                  .filter(s => s.goal_amount && s.goal_amount > 0) // Only show items with actual goals
                  .map(saving => (
                    <div key={saving.id}>
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="font-medium truncate pr-2" title={saving.title}>{saving.title}</span>
                        <span className="text-muted-foreground flex-shrink-0">
                          {getProgress(saving).toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={getProgress(saving)} className="h-2" />
                    </div>
                  ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No active savings goals with target amounts set.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Savings List Table */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Savings Details</CardTitle>
            <CardDescription>Your recorded savings goals and history.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              // Simple Table Skeleton Loader
              <div className="space-y-2">
                <div className="h-10 bg-muted rounded w-full"></div> {/* Header */}
                {[...Array(3)].map((_, i) => (<div key={i} className="h-12 bg-muted/50 rounded w-full"></div>))}
              </div>
            ) : savings.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead sortKey="title" currentSort={sortConfig} requestSort={requestSort}>Title</SortableTableHead>
                      <SortableTableHead sortKey="amount" currentSort={sortConfig} requestSort={requestSort}>Current</SortableTableHead>
                      <SortableTableHead sortKey="goal_amount" currentSort={sortConfig} requestSort={requestSort}>Goal</SortableTableHead>
                      <SortableTableHead sortKey="progress" currentSort={sortConfig} requestSort={requestSort}>Progress</SortableTableHead>
                      <TableHead>Projection (per wk/mo)</TableHead>
                      <SortableTableHead sortKey="target_date" currentSort={sortConfig} requestSort={requestSort}>Target Date</SortableTableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSavings.map((saving) => {
                      const progress = getProgress(saving);
                      const isCompleted = saving.goal_amount && saving.amount >= saving.goal_amount;
                      const { weekly, monthly, remainingAmount } = calculateProjections(saving); // Calculate projections

                      return (
                        <TableRow key={saving.id} className={cn(isCompleted && "bg-green-50 dark:bg-green-900/20")}>
                          <TableCell className="font-medium max-w-[150px] truncate" title={saving.title}>{saving.title}</TableCell>
                          <TableCell>{formatCurrency(saving.amount)}</TableCell>
                          <TableCell>{saving.goal_amount ? formatCurrency(saving.goal_amount) : <span className="text-muted-foreground text-xs">N/A</span>}</TableCell>
                          <TableCell>
                            {saving.goal_amount ? (
                              <div className="flex items-center gap-2 min-w-[120px]"> {/* Ensure minimum width */}
                                <Progress value={progress} className="h-2 flex-grow" />
                                <span className="text-xs font-medium w-10 text-right">
                                  {progress.toFixed(0)}%
                                </span>
                                {isCompleted && <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">No goal set</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {isCompleted ? (
                              <span className="text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Goal Reached!</span>
                            ) : weekly !== null || monthly !== null ? (
                              <div className="flex flex-col">
                                {weekly !== null && <span title={`Remaining: ${formatCurrency(remainingAmount)}`}>{formatCurrency(weekly)}/wk</span>}
                                {monthly !== null && <span title={`Remaining: ${formatCurrency(remainingAmount)}`}>{formatCurrency(monthly)}/mo</span>}
                              </div>
                            ) : saving.goal_amount && saving.target_date ? (
                              <span className="text-muted-foreground">No target date or past due</span>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>{saving.target_date ? formatDate(saving.target_date) : <span className="text-muted-foreground text-xs">None</span>}</TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              {/* Add Funds */}
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Add Funds" onClick={() => openAddFundsDialog(saving)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                              {/* Edit */}
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => openEditDialog(saving)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {/* Delete */}
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" title="Delete" onClick={() => confirmDelete(saving)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              // Enhanced Empty State
              <div className="text-center py-16 px-6 border rounded-md">
                <PiggyBank className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Savings Goals Yet</h3>
                <p className="text-muted-foreground mb-6">
                  Start tracking your progress towards your financial goals.
                </p>
                {/* Also include the Add Dialog Trigger here for convenience */}
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Goal
                    </Button>
                  </DialogTrigger>
                  <SavingFormDialog
                    mode="add"
                    onOpenChange={setAddDialogOpen}
                    onSubmit={handleAddSaving}
                    isSubmitting={isSubmitting}
                  />
                </Dialog>
              </div>
            )}
          </CardContent>
        </Card>

        {/* --- Dialog Containers (The content is rendered inside these when open) --- */}

        {/* Edit Saving Dialog Container */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          {/* SavingFormDialog will be rendered here when editDialogOpen is true */}
          {savingToEdit && (
            <SavingFormDialog
              key={savingToEdit.id} // Re-mount with new initial data if savingToEdit changes
              mode="edit"
              onOpenChange={setEditDialogOpen} // Pass the setter to allow closing
              onSubmit={handleEditSaving}
              isSubmitting={isSubmitting}
              initialData={savingToEdit}
            />
          )}
        </Dialog>


        {/* Delete Confirmation Dialog Container */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Saving Goal</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the goal "{savingToDelete?.title}"? This includes its current saved amount.
              </DialogDescription>
            </DialogHeader>
            <Alert variant="destructive">
              <AlertDescription>
                This action cannot be undone and will permanently remove the record.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteSaving} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isDeleting ? "Deleting..." : "Yes, Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Funds Dialog Container */}
        <Dialog open={addFundsDialogOpen} onOpenChange={setAddFundsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Funds to "{savingToAddFunds?.title}"</DialogTitle>
              <DialogDescription>Increase the saved amount for this goal.</DialogDescription>
            </DialogHeader>
            {savingToAddFunds && (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Current Amount</Label>
                    <div className="text-lg font-semibold">{formatCurrency(savingToAddFunds.amount)}</div>
                  </div>
                  {savingToAddFunds.goal_amount && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Goal Amount</Label>
                      <div className="text-lg font-semibold">{formatCurrency(savingToAddFunds.goal_amount)}</div>
                    </div>
                  )}
                </div>
                {savingToAddFunds.goal_amount && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Progress</Label>
                    <Progress value={getProgress(savingToAddFunds)} className="h-2" />
                    <div className="text-sm text-muted-foreground">
                      {getProgress(savingToAddFunds).toFixed(1)}% funded
                      {savingToAddFunds.target_date && ` (Target: ${formatDate(savingToAddFunds.target_date)})`}
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="additionalAmount">Amount to Add</Label>
                  <Input
                    id="additionalAmount" type="number" step="0.01" min="0.01"
                    placeholder="0.00" value={additionalAmount}
                    onChange={(e) => setAdditionalAmount(e.target.value)}
                    autoFocus // Focus this field when dialog opens
                  />
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="deductFunds"
                    checked={deductFromBalanceFunds}
                    onCheckedChange={(checked) => setDeductFromBalanceFunds(checked as boolean)}
                  />
                  <Label htmlFor="deductFunds" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Deduct from balance (create expense)
                  </Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddFundsDialogOpen(false)} disabled={isUpdatingFunds}>Cancel</Button>
              <Button onClick={handleAddFunds} disabled={isUpdatingFunds || !additionalAmount || parseFloat(additionalAmount) <= 0}>
                {isUpdatingFunds ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isUpdatingFunds ? "Adding..." : "Add Funds"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
};

// --- Reusable Saving Form Dialog Component ---
interface SavingFormDialogProps {
  mode: 'add' | 'edit';
  // isOpen prop removed - controlled by parent <Dialog>
  onOpenChange: (open: boolean) => void; // Needed to close the dialog from within
  onSubmit: (formData: SavingFormData) => Promise<void>;
  isSubmitting: boolean;
  initialData?: Saving | null; // Provide for edit mode
}

// Updated component signature (removed isOpen prop)
const SavingFormDialog = ({ mode, onOpenChange, onSubmit, isSubmitting, initialData }: SavingFormDialogProps) => {
  // Form state specific to this dialog instance
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState(''); // Represents current amount in edit, initial in add
  const [goalAmount, setGoalAmount] = useState('');
  const [date, setDate] = useState<Date>(new Date()); // Date started / initial contribution date
  const [targetDate, setTargetDate] = useState<Date | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [deductFromBalance, setDeductFromBalance] = useState(false);

  // Pre-fill form for edit mode or reset for add mode
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setTitle(initialData.title || '');
      setAmount(String(initialData.amount || 0));
      setGoalAmount(String(initialData.goal_amount || ''));
      setDate(initialData.date ? new Date(initialData.date) : new Date());
      setTargetDate(initialData.target_date ? new Date(initialData.target_date) : undefined);
      setDescription(initialData.description || '');
    } else {
      // Reset for add mode (or if initialData is null in edit mode somehow)
      setTitle('');
      setAmount('');
      setGoalAmount('');
      setDate(new Date());
      setTargetDate(undefined);
      setDescription('');
      setDeductFromBalance(false);
    }
    // Only depend on mode and initialData to trigger reset/prefill
  }, [mode, initialData]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData: SavingFormData = { title, amount, goalAmount, date, targetDate, description, deductFromBalance };
    onSubmit(formData);
    // Form state reset is handled by the useEffect above when initialData changes or mode changes
  };

  // DialogContent is the root here, and it receives context from the parent <Dialog>
  return (
    <DialogContent className="sm:max-w-[525px]">
      <DialogHeader>
        <DialogTitle>{mode === 'add' ? 'Add New Saving Goal' : 'Edit Saving Goal'}</DialogTitle>
        <DialogDescription>
          {mode === 'add' ? 'Define a new goal and record any initial amount saved.' : 'Update the details for this saving goal.'}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit}>
        <div className="grid gap-4 py-4">
          {/* Title */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">Title</Label>
            <Input id="title" placeholder="e.g., Emergency Fund" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" required />
          </div>
          {/* Amount */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">{mode === 'add' ? 'Initial Amount' : 'Current Amount'}</Label>
            <Input id="amount" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="col-span-3" required />
          </div>
          {/* Goal Amount */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="goalAmount" className="text-right">Goal Amount</Label>
            <Input id="goalAmount" type="number" step="0.01" min="0.01" placeholder="Optional: e.g., 1000.00" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} className="col-span-3" />
          </div>
          {/* Date */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date-popover" className="text-right">{mode === 'add' ? 'Date Started' : 'Date Started'}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button id="date-popover" variant="outline" className={cn("col-span-3 justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          {/* Target Date */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="targetDate-popover" className="text-right">Target Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button id="targetDate-popover" variant="outline" className={cn("col-span-3 justify-start text-left font-normal", !targetDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {targetDate ? format(targetDate, "PPP") : <span>Optional: Pick a target</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={targetDate} onSelect={setTargetDate} fromDate={new Date()} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          {/* Description */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="description" className="text-right pt-2">Notes</Label>
            <Textarea id="description" placeholder="Optional: e.g., For down payment..." value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" />
          </div>

          {/* Deduct Checkbox (Only for Add Mode) */}
          {mode === 'add' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="col-start-2 col-span-3 flex items-center space-x-2">
                <Checkbox
                  id="deductNew"
                  checked={deductFromBalance}
                  onCheckedChange={(checked) => setDeductFromBalance(checked as boolean)}
                />
                <Label htmlFor="deductNew" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Deduct initial amount from balance
                </Label>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? (mode === 'add' ? 'Adding...' : 'Saving...') : (mode === 'add' ? 'Add Goal' : 'Save Changes')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

// --- Reusable Sortable Table Head ---
interface SortableTableHeadProps {
  sortKey: SortableKeys;
  currentSort: { key: SortableKeys; direction: 'asc' | 'desc' };
  requestSort: (key: SortableKeys) => void;
  children: React.ReactNode;
  className?: string;
}

const SortableTableHead = ({ sortKey, currentSort, requestSort, children, className }: SortableTableHeadProps) => {
  const isSorted = currentSort.key === sortKey;
  const direction = isSorted ? currentSort.direction : 'none';

  return (
    <TableHead className={cn("cursor-pointer hover:bg-muted/50 p-2 h-10", className)} onClick={() => requestSort(sortKey)}> {/* Added padding/height */}
      <div className="flex items-center gap-1 sm:gap-2"> {/* Reduced gap */}
        <span className="text-xs sm:text-sm">{children}</span> {/* Responsive text */}
        <ArrowUpDown
          className={cn("h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0", isSorted && "text-foreground")}
          strokeWidth={isSorted ? 2.5 : 1.5} // Adjusted stroke
        />
      </div>
    </TableHead>
  );
};


export default SavingsPage;