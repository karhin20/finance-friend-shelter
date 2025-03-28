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
import { CalendarIcon, Plus, PiggyBank, ArrowUpDown, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, formatCurrency, formatDate } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

// Define the Savings type
type Saving = {
  id: string;
  user_id: string;
  amount: number;
  goal_amount: number;
  title: string;
  date: string;
  target_date?: string;
  description?: string;
};

const SavingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [savings, setSavings] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [amount, setAmount] = useState<string>('');
  const [goalAmount, setGoalAmount] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [date, setDate] = useState<Date>(new Date());
  const [targetDate, setTargetDate] = useState<Date | undefined>(undefined);
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete state
  const [savingToDelete, setSavingToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Add this state for current savings
  const [currentSavings, setCurrentSavings] = useState<number>(0);

  // Add a new state variable to track which saving is being updated
  const [selectedSaving, setSelectedSaving] = useState<Saving | null>(null);
  const [additionalAmount, setAdditionalAmount] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

  // Fetch saving data
  useEffect(() => {
    if (!user) return;

    const fetchSavings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('savings')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false });

        if (error) throw error;
        setSavings(data || []);
      } catch (error: any) {
        console.error('Error fetching savings:', error.message);
        toast({
          title: 'Error',
          description: 'Failed to load savings data. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    // Update useEffect to load savings and current month savings
    const loadData = async () => {
      await fetchSavings();
      const monthlySavings = await getCurrentMonthSavings();
      setCurrentSavings(monthlySavings);
    };
    
    loadData();
  }, [user, toast]);

  // Add new saving
  const handleAddSaving = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !amount || !title) {
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

    const goalAmountNum = goalAmount ? parseFloat(goalAmount) : null;
    if (goalAmount && (isNaN(goalAmountNum!) || goalAmountNum! <= 0)) {
      toast({
        title: 'Invalid goal amount',
        description: 'Please enter a valid positive number for the goal.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('savings').insert([
        {
          user_id: user.id,
          amount: amountNum,
          goal_amount: goalAmountNum,
          title,
          date: date.toISOString(),
          target_date: targetDate ? targetDate.toISOString() : null,
          description: description.trim() || null,
        },
      ]).select();

      if (error) throw error;

      // Reset form and update savings list
      setAmount('');
      setGoalAmount('');
      setTitle('');
      setDate(new Date());
      setTargetDate(undefined);
      setDescription('');
      setSavings([...(data || []), ...savings]);

      toast({
        title: 'Saving added',
        description: `Successfully added ${formatCurrency(amountNum)} to your savings.`,
      });
    } catch (error: any) {
      console.error('Error adding saving:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add saving. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete saving
  const confirmDelete = (id: string) => {
    setSavingToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!savingToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('savings')
        .delete()
        .eq('id', savingToDelete);

      if (error) throw error;

      // Update savings list
      setSavings(savings.filter(saving => saving.id !== savingToDelete));
      toast({
        title: 'Saving deleted',
        description: 'The saving has been successfully deleted.',
      });
    } catch (error: any) {
      console.error('Error deleting saving:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete saving. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setSavingToDelete(null);
    }
  };

  // Calculate total savings
  const totalSavings = savings.reduce((sum, saving) => sum + saving.amount, 0);

  // Calculate progress for each saving goal
  const getProgress = (saving: Saving) => {
    if (!saving.goal_amount) return 100;
    return Math.min(100, (saving.amount / saving.goal_amount) * 100);
  };

  // Add this function to the component
  const getCurrentMonthSavings = async () => {
    if (!user) return 0;
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    try {
      // Get current month income
      const { data: incomeData, error: incomeError } = await supabase
        .from('income')
        .select('amount')
        .eq('user_id', user.id)
        .gte('date', startOfMonth.toISOString())
        .lte('date', now.toISOString());
      
      if (incomeError) throw incomeError;
      
      // Get current month expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('amount')
        .eq('user_id', user.id)
        .gte('date', startOfMonth.toISOString())
        .lte('date', now.toISOString());
      
      if (expensesError) throw expensesError;
      
      const totalIncome = incomeData?.reduce((sum, item) => sum + item.amount, 0) || 0;
      const totalExpenses = expensesData?.reduce((sum, item) => sum + item.amount, 0) || 0;
      
      return totalIncome - totalExpenses;
    } catch (error) {
      console.error("Error calculating current month savings:", error);
      return 0;
    }
  };

  // Add a function to open the update dialog
  const openUpdateDialog = (saving: Saving) => {
    setSelectedSaving(saving);
    setAdditionalAmount('');
    setUpdateDialogOpen(true);
  };

  // Add a function to handle adding to an existing saving
  const handleAddToSaving = async () => {
    if (!user || !selectedSaving || !additionalAmount) return;
    
    const amountToAdd = parseFloat(additionalAmount);
    if (isNaN(amountToAdd) || amountToAdd <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid positive number.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsUpdating(true);
    
    try {
      // Calculate the new total amount
      const newAmount = selectedSaving.amount + amountToAdd;
      
      // Update the saving in the database
      const { error } = await supabase
        .from('savings')
        .update({ amount: newAmount })
        .eq('id', selectedSaving.id)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      // Update the local state
      setSavings(savings.map(s => 
        s.id === selectedSaving.id 
          ? { ...s, amount: newAmount } 
          : s
      ));
      
      toast({
        title: 'Saving updated',
        description: `Added ${formatCurrency(amountToAdd)} to ${selectedSaving.title}.`,
      });
      
      setUpdateDialogOpen(false);
    } catch (error: any) {
      console.error('Error updating saving:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update saving. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Savings</h1>
          <p className="text-muted-foreground">Track your savings and goals</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Summary Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle>Total Savings</CardTitle>
              <CardDescription>Your current savings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {formatCurrency(totalSavings)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-6">
          {/* Delete this entire Card:
          <Card>
            <CardHeader>
              <CardTitle>Current Month Savings</CardTitle>
              <CardDescription>Based on income minus expenses this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(currentSavings)}
              </div>
              <p className="text-muted-foreground mt-2">
                {currentSavings > 0 
                  ? "You're saving money this month!" 
                  : "Your expenses exceed your income this month."}
              </p>
            </CardContent>
          </Card> */}
          
          <Card>
            <CardHeader>
              <CardTitle>Savings Goal Progress</CardTitle>
              <CardDescription>Current savings compared to goals</CardDescription>
            </CardHeader>
            <CardContent>
              {savings.some(s => s.goal_amount) ? (
                savings
                  .filter(s => s.goal_amount)
                  .map(saving => (
                    <div key={saving.id} className="mb-4">
                      <div className="flex justify-between mb-1">
                        <span>{saving.title}</span>
                        <span>{formatCurrency(saving.amount)} / {formatCurrency(saving.goal_amount)}</span>
                      </div>
                      <Progress value={(saving.amount / saving.goal_amount) * 100} className="h-2" />
                    </div>
                  ))
              ) : (
                <p className="text-muted-foreground">No savings goals set yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Add New Saving */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Add New Saving</CardTitle>
              <CardDescription>
                Record money you've saved or set a savings goal
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleAddSaving}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Saving Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Emergency Fund, New Car"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount Saved</Label>
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
                  <Label htmlFor="goalAmount">Goal Amount (Optional)</Label>
                  <Input
                    id="goalAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={goalAmount}
                    onChange={(e) => setGoalAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date Saved</Label>
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
                  <Label htmlFor="targetDate">Target Date (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        id="targetDate"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !targetDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {targetDate ? format(targetDate, "PPP") : <span>Set a target date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={targetDate}
                        onSelect={(date) => setTargetDate(date)}
                        initialFocus
                        fromDate={new Date()}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Notes (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Any additional information about this saving"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  <Plus className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Saving..." : "Record Saving"}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Savings List */}
          <Card className="md:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle>Savings History</CardTitle>
              <CardDescription>
                Your savings records and progress towards goals
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4 animate-pulse">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex justify-between p-2">
                      <div className="h-6 w-24 bg-muted rounded"></div>
                      <div className="h-6 w-20 bg-muted rounded"></div>
                    </div>
                  ))}
                </div>
              ) : savings.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savings.map((saving) => (
                        <TableRow key={saving.id}>
                          <TableCell className="font-medium">{saving.title}</TableCell>
                          <TableCell>{formatCurrency(saving.amount)}</TableCell>
                          <TableCell>{formatDate(saving.date)}</TableCell>
                          <TableCell>
                            {saving.goal_amount ? (
                              <div className="space-y-1">
                                <Progress value={getProgress(saving)} className="h-2" />
                                <div className="text-xs text-muted-foreground">
                                  {formatCurrency(saving.amount)} of {formatCurrency(saving.goal_amount)}
                                  {saving.target_date && ` by ${formatDate(saving.target_date)}`}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">No goal set</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => openUpdateDialog(saving)}
                                className="text-muted-foreground hover:text-primary"
                                title="Add Funds"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => confirmDelete(saving.id)}
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
                  <PiggyBank className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
                  <p className="text-muted-foreground mb-6">No savings records yet</p>
                  <p className="text-sm text-muted-foreground mb-4">Use the form to add your first saving</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Delete confirmation dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Saving</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this saving record? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <Alert variant="destructive">
              <AlertDescription>
                Deleting this saving will permanently remove it from your records.
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

        {/* Update dialog */}
        <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Saving</DialogTitle>
              <DialogDescription>
                Add more funds to your existing saving goal.
              </DialogDescription>
            </DialogHeader>
            
            {selectedSaving && (
              <div className="space-y-4 py-2">
                <div className="flex flex-col gap-2">
                  <Label>Current Amount</Label>
                  <div className="text-lg font-semibold">{formatCurrency(selectedSaving.amount)}</div>
                </div>
                
                {selectedSaving.goal_amount && (
                  <div className="space-y-2">
                    <Label>Goal Progress</Label>
                    <Progress value={(selectedSaving.amount / selectedSaving.goal_amount) * 100} className="h-2" />
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(selectedSaving.amount)} of {formatCurrency(selectedSaving.goal_amount)}
                      {selectedSaving.target_date && ` by ${formatDate(selectedSaving.target_date)}`}
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="additionalAmount">Additional Amount</Label>
                  <Input
                    id="additionalAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={additionalAmount}
                    onChange={(e) => setAdditionalAmount(e.target.value)}
                  />
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setUpdateDialogOpen(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddToSaving}
                disabled={isUpdating || !additionalAmount}
              >
                {isUpdating ? "Updating..." : "Add Funds"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default SavingsPage; 