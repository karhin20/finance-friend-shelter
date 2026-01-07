import { useState, useEffect, useMemo, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInWeeks, differenceInMonths, isAfter, startOfDay } from 'date-fns';
import { Plus, PiggyBank, Trash2, Pencil, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, formatDate } from '@/lib/supabase';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useFinance } from '@/contexts/FinanceContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';

// New Components
import { SavingsForm, SavingFormData } from '@/components/savings/SavingsForm';
import { AddFundsDialog } from '@/components/savings/AddFundsDialog';

// Types
type Saving = {
  id: string;
  user_id: string;
  amount: number;
  goal_amount: number | null;
  title: string;
  date: string;
  target_date?: string | null;
  description?: string | null;
  created_at: string;
};

type SortableKeys = keyof Omit<Saving, 'user_id' | 'description'> | 'progress';

// Helper for sorting headers (can be extracted if reused across pages)
const SortableTableHead = ({ sortKey, children, currentSort, requestSort }: { sortKey: SortableKeys, children: React.ReactNode, currentSort: any, requestSort: any }) => (
  <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => requestSort(sortKey)}>
    <div className="flex items-center gap-1">
      {children}
      {currentSort.key === sortKey && (
        <span className="text-xs">{currentSort.direction === 'asc' ? '↑' : '↓'}</span>
      )}
    </div>
  </TableHead>
);

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

const SavingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { addExpenseMutation } = useFinance();
  const queryClient = useQueryClient();

  const { data: savings = [], isLoading: loading } = useQuery({
    queryKey: ['savings', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('savings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching savings:', error.message);
        throw error;
      }
      return data as Saving[] || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 30, // 30 minutes cache
  });

  // Dialog States
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addFundsDialogOpen, setAddFundsDialogOpen] = useState(false);

  // Item Selection States
  const [savingToEdit, setSavingToEdit] = useState<Saving | null>(null);
  const [savingToDelete, setSavingToDelete] = useState<Saving | null>(null);
  const [savingToAddFunds, setSavingToAddFunds] = useState<Saving | null>(null);

  // Loading States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingFunds, setIsUpdatingFunds] = useState(false);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc',
  });



  const totalSavings = useMemo(() => savings.reduce((sum, saving) => sum + saving.amount, 0), [savings]);

  const getProgress = useCallback((saving: Saving): number => {
    if (!saving.goal_amount || saving.goal_amount <= 0) return 0;
    if (saving.amount <= 0) return 0;
    return Math.min(100, Math.max(0, (saving.amount / saving.goal_amount) * 100));
  }, []);

  // Sorting
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
        aValue = a[key as keyof Saving] ?? (sortConfig.direction === 'asc' ? Infinity : -Infinity);
        bValue = b[key as keyof Saving] ?? (sortConfig.direction === 'asc' ? Infinity : -Infinity);
      } else if (key === 'date' || key === 'target_date' || key === 'created_at') {
        aValue = a[key as keyof Saving] ? new Date(a[key as keyof Saving]!).getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
        bValue = b[key as keyof Saving] ? new Date(b[key as keyof Saving]!).getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
      } else {
        aValue = a[key as keyof Saving] ?? '';
        bValue = b[key as keyof Saving] ?? '';
        return aValue.localeCompare(bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortableItems;
  }, [savings, sortConfig, getProgress]);

  // Handlers
  const handleAddSaving = async (formData: SavingFormData) => {
    if (!user) return;
    const amountNum = parseFloat(formData.amount);
    const goalAmountNum = formData.goalAmount ? parseFloat(formData.goalAmount) : null;

    if (isNaN(amountNum) || amountNum < 0) {
      toast({ title: 'Invalid Initial Amount', description: 'Please enter a valid number.', variant: 'destructive' }); return;
    }
    if (formData.goalAmount && (isNaN(goalAmountNum!) || goalAmountNum! <= 0)) {
      toast({ title: 'Invalid Goal Amount', description: 'Goal amount must be positive.', variant: 'destructive' }); return;
    }
    if (!formData.title.trim()) {
      toast({ title: 'Title Required', description: 'Please enter a title.', variant: 'destructive' }); return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('savings').insert([{
        user_id: user.id,
        title: formData.title.trim(),
        amount: amountNum,
        goal_amount: goalAmountNum,
        date: formData.date.toISOString(),
        target_date: formData.targetDate ? formData.targetDate.toISOString() : null,
        description: formData.description.trim() || null,
      }]).select().single();

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['savings', user.id] });

      if (formData.deductFromBalance && amountNum > 0) {
        addExpenseMutation.mutate({
          amount: amountNum,
          description: `Transfer to Savings: ${data.title}`,
          date: new Date().toISOString(),
          category: 'Savings',
        });
      }

      toast({ title: 'Saving Goal Added', description: `Successfully added "${data.title}".` });
      setAddDialogOpen(false);
    } catch (error: any) {
      console.error('Error adding saving:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSaving = async (formData: SavingFormData) => {
    if (!user || !savingToEdit) return;
    const amountNum = parseFloat(formData.amount);
    const goalAmountNum = formData.goalAmount ? parseFloat(formData.goalAmount) : null;

    if (isNaN(amountNum) || amountNum < 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter a valid amount.', variant: 'destructive' }); return;
    }
    if (formData.goalAmount && (isNaN(goalAmountNum!) || goalAmountNum! <= 0)) {
      toast({ title: 'Invalid Goal Amount', description: 'Goal amount must be positive.', variant: 'destructive' }); return;
    }
    if (!formData.title.trim()) {
      toast({ title: 'Title Required', description: 'Please enter a title.', variant: 'destructive' }); return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('savings')
        .update({
          title: formData.title.trim(),
          amount: amountNum,
          goal_amount: goalAmountNum,
          date: formData.date.toISOString(),
          target_date: formData.targetDate ? formData.targetDate.toISOString() : null,
          description: formData.description.trim() || null,
        })
        .eq('id', savingToEdit.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['savings', user.id] });
      toast({ title: 'Updated', description: `Updated "${data.title}".` });
      setEditDialogOpen(false);
      setSavingToEdit(null);
    } catch (error: any) {
      console.error('Error updating:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSaving = async () => {
    if (!savingToDelete || !user) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('savings').delete().eq('id', savingToDelete.id).eq('user_id', user.id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['savings', user.id] });
      toast({ title: 'Deleted', description: `Deleted "${savingToDelete.title}".` });
      setDeleteDialogOpen(false);
      setSavingToDelete(null);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddFunds = async (amountToAdd: number, deductFromBalance: boolean) => {
    if (!user || !savingToAddFunds) return;
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

      queryClient.invalidateQueries({ queryKey: ['savings', user.id] });

      if (deductFromBalance) {
        addExpenseMutation.mutate({
          amount: amountToAdd,
          description: `Transfer to Savings: ${savingToAddFunds.title}`,
          date: new Date().toISOString(),
          category: 'Savings',
        });
      }

      toast({ title: 'Funds Added', description: `Added ${formatCurrency(amountToAdd)} to "${savingToAddFunds.title}".` });

      // Check if goal was just completed
      const wasCompleted = savingToAddFunds.goal_amount && savingToAddFunds.amount < savingToAddFunds.goal_amount;
      const isNowCompleted = savingToAddFunds.goal_amount && newAmount >= savingToAddFunds.goal_amount;

      if (wasCompleted && isNowCompleted) {
        // Fire confetti! 🎉
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        toast({ title: '🎉 Goal Achieved!', description: `You've reached your goal for "${savingToAddFunds.title}"!` });
      }

      setAddFundsDialogOpen(false);
      setSavingToAddFunds(null);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsUpdatingFunds(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 rounded-[2rem] bg-white/50 dark:bg-card/50 border border-border/40 backdrop-blur-sm gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm shadow-primary/5">
              <PiggyBank className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Saved</p>
              <p className="text-3xl font-black tracking-tight">{loading ? '...' : formatCurrency(totalSavings)}</p>
            </div>
          </div>
          <Button
            onClick={() => setAddDialogOpen(true)}
            className="w-full sm:w-auto h-12 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
          >
            <Plus className="mr-2 h-5 w-5" />
            New Goal
          </Button>
        </div>

        {/* Goals Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Progress Overview Card */}
          <Card className="shadow-sm border-border/40 rounded-[2rem] md:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Goal Progress</CardTitle>
              <CardDescription>Track your active savings targets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {loading ? (
                <div className="flex justify-center p-4"><Loader2 className="animate-spin text-muted-foreground" /></div>
              ) : savings.filter(s => s.goal_amount && s.goal_amount > 0).length > 0 ? (
                savings
                  .filter(s => s.goal_amount && s.goal_amount > 0)
                  .map(saving => (
                    <div key={saving.id} className="space-y-2">
                      <div className="flex justify-between items-end">
                        <span className="font-bold text-sm truncate max-w-[150px]">{saving.title}</span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {getProgress(saving).toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={getProgress(saving)} className="h-2.5 rounded-full" />
                    </div>
                  ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No active goals with targets set.</p>
              )}
            </CardContent>
          </Card>

          {/* Helper Card or Stats */}
          <Card className="shadow-sm border-border/40 rounded-[2rem] bg-gradient-to-br from-primary/5 to-transparent relative overflow-hidden lg:col-span-1 border-none">
            <div className="absolute right-0 top-0 w-32 h-32 bg-primary/10 rounded-bl-[4rem] z-0" />
            <CardHeader className="relative z-10">
              <CardTitle className="text-lg font-bold">Smart Tips</CardTitle>
              <CardDescription>Achieve your financial dreams faster.</CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 text-sm text-muted-foreground space-y-2">
              <p>• Set clear target dates to stay motivated.</p>
              <p>• Automate your savings by checking "Deduct from balance".</p>
              <p>• Even small contributions add up over time!</p>
            </CardContent>
          </Card>
        </div>

        {/* Savings List */}
        <div className="space-y-4">
          <h3 className="text-xl font-black tracking-tight px-2">Your Savings Goals</h3>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted/20 animate-pulse rounded-[1.5rem]" />)}
            </div>
          ) : savings.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <Card className="hidden md:block shadow-sm border-border/40 rounded-[2rem] overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-transparent border-border/30">
                        <SortableTableHead sortKey="title" currentSort={sortConfig} requestSort={requestSort}>Title</SortableTableHead>
                        <SortableTableHead sortKey="amount" currentSort={sortConfig} requestSort={requestSort}>Current</SortableTableHead>
                        <SortableTableHead sortKey="goal_amount" currentSort={sortConfig} requestSort={requestSort}>Goal</SortableTableHead>
                        <SortableTableHead sortKey="progress" currentSort={sortConfig} requestSort={requestSort}>Progress</SortableTableHead>
                        <TableHead>Target Date</TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedSavings.map((saving) => {
                        const isCompleted = saving.goal_amount && saving.amount >= saving.goal_amount;
                        return (
                          <TableRow key={saving.id} className={cn("border-border/30 hover:bg-muted/10 transition-colors", isCompleted && "bg-green-50/40 dark:bg-green-900/10")}>
                            <TableCell className="font-bold py-4 pl-6 text-base">{saving.title}</TableCell>
                            <TableCell className="font-mono text-muted-foreground">{formatCurrency(saving.amount)}</TableCell>
                            <TableCell className="font-mono text-muted-foreground">{saving.goal_amount ? formatCurrency(saving.goal_amount) : '-'}</TableCell>
                            <TableCell className="w-[20%]">
                              {saving.goal_amount ? <Progress value={getProgress(saving)} className="h-2 w-full" /> : <span className="text-xs text-muted-foreground">N/A</span>}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">{saving.target_date ? formatDate(saving.target_date) : '-'}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary" onClick={() => { setSavingToAddFunds(saving); setAddFundsDialogOpen(true); }}>
                                  <Plus className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => { setSavingToEdit(saving); setEditDialogOpen(true); }}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => { setSavingToDelete(saving); setDeleteDialogOpen(true); }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Mobile Cards View */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {sortedSavings.map((saving) => {
                  const progress = getProgress(saving);
                  const isCompleted = saving.goal_amount && saving.amount >= saving.goal_amount;
                  return (
                    <div key={saving.id} className={cn(
                      "relative bg-card rounded-[2rem] p-5 border border-border/40 shadow-sm overflow-hidden active:scale-[0.99] transition-transform",
                      isCompleted && "bg-green-50/50 dark:bg-green-900/10 border-green-200/50"
                    )}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-black text-lg leading-tight mb-1">{saving.title}</h4>
                          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
                            Target: {saving.target_date ? formatDate(saving.target_date) : 'No Date'}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => { setSavingToEdit(saving); setEditDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => { setSavingToDelete(saving); setDeleteDialogOpen(true); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black tracking-tighter">{formatCurrency(saving.amount).replace('.00', '')}</span>
                          {saving.goal_amount && <span className="text-sm font-medium text-muted-foreground">/ {formatCurrency(saving.goal_amount).replace('.00', '')}</span>}
                        </div>
                      </div>

                      {saving.goal_amount && (
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between text-xs font-bold">
                            <span className={isCompleted ? "text-green-600" : "text-primary"}>{isCompleted ? "Goal Met!" : `${progress.toFixed(0)}% Funded`}</span>
                          </div>
                          <Progress value={progress} className="h-3 rounded-full bg-muted" />
                        </div>
                      )}

                      <Button
                        onClick={() => { setSavingToAddFunds(saving); setAddFundsDialogOpen(true); }}
                        className="w-full h-12 rounded-xl font-bold shadow-sm"
                        variant={isCompleted ? "outline" : "default"}
                      >
                        {isCompleted ? "Add Bonus Funds" : "Add Funds"} <Plus className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6 border border-border/50 border-dashed rounded-[2rem] bg-muted/20 text-center">
              <div className="h-20 w-20 rounded-[2rem] bg-background shadow-sm flex items-center justify-center mb-6 text-muted-foreground/30">
                <PiggyBank className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">No Savings Goals Yet</h3>
              <p className="text-muted-foreground max-w-[280px] mb-8">Start tracking your progress towards your financial dreams today.</p>
              <Button onClick={() => setAddDialogOpen(true)} className="h-12 px-8 rounded-2xl font-bold shadow-lg shadow-primary/20">
                Create First Goal
              </Button>
            </div>
          )}
        </div>

        {/* --- Dialogs --- */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="sm:max-w-[500px] rounded-[2rem] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Savings Goal</DialogTitle>
              <DialogDescription>Set a target to save for something special.</DialogDescription>
            </DialogHeader>
            <SavingsForm
              mode="add"
              onSubmit={handleAddSaving}
              isSubmitting={isSubmitting}
              onCancel={() => setAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px] rounded-[2rem] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Goal</DialogTitle>
              <DialogDescription>Update your savings target details.</DialogDescription>
            </DialogHeader>
            {savingToEdit && (
              <SavingsForm
                mode="edit"
                initialData={savingToEdit}
                onSubmit={handleEditSaving}
                isSubmitting={isSubmitting}
                onCancel={() => setEditDialogOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>

        <AddFundsDialog
          open={addFundsDialogOpen}
          onOpenChange={setAddFundsDialogOpen}
          saving={savingToAddFunds}
          onSubmit={handleAddFunds}
          isSubmitting={isUpdatingFunds}
        />

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="rounded-[2rem]">
            <DialogHeader>
              <DialogTitle>Delete Goal?</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <span className="font-bold text-foreground">"{savingToDelete?.title}"</span>? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <Alert variant="destructive" className="rounded-xl border-destructive/20 bg-destructive/5">
              <AlertDescription className="text-destructive font-medium">
                The saved history for this goal will be lost.
              </AlertDescription>
            </Alert>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" className="rounded-xl font-bold" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>Cancel</Button>
              <Button variant="destructive" className="rounded-xl font-bold" onClick={handleDeleteSaving} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete Goal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
};

export default SavingsPage;