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
import { CalendarIcon, Plus, Search, ArrowUpDown, Pencil, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, formatCurrency, formatDate, Income } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const IncomePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [income, setIncome] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Form state
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<Date>(new Date());
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const [editDescription, setEditDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Add recurring options to the income form
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

  // Fetch income data
  useEffect(() => {
    if (!user) return;

    const fetchIncome = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('income')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false });

        if (error) {
          console.error('Error fetching income:', error);
          
          // If table doesn't exist, redirect to db-setup
          if (error.message.includes('does not exist')) {
            toast({
              title: 'Database setup needed',
              description: 'Tables need to be created. Redirecting to setup page.',
              variant: 'destructive',
            });
            
            // Wait a moment to show the toast, then redirect
            setTimeout(() => {
              navigate('/db-setup');
            }, 1500);
            return;
          }
          
          throw error;
        }
        
        setIncome(data || []);
      } catch (error: any) {
        console.error('Error fetching income:', error.message);
        toast({
          title: 'Error',
          description: 'Failed to load income data. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchIncome();
  }, [user, toast, navigate]);

  // Add new income
  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !amount || !date) {
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
      const { data, error } = await supabase.from('income').insert([
        {
          user_id: user.id,
          amount: amountNum,
          date: date.toISOString(),
          description: description.trim() || null,
        },
      ]).select();

      if (error) throw error;

      // Reset form and update income list
      setAmount('');
      setDate(new Date());
      setDescription('');
      setIncome([...(data || []), ...income]);

      toast({
        title: 'Income added',
        description: `Successfully added ${formatCurrency(amountNum)} to your income.`,
      });
    } catch (error: any) {
      console.error('Error adding income:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add income. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtering and sorting logic
  const filteredIncome = income.filter(item =>
    item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    formatCurrency(item.amount).includes(searchQuery) ||
    formatDate(item.date).toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  // Add a function to open the edit dialog
  const openEditDialog = (income: Income) => {
    setEditingIncome(income);
    setEditAmount(income.amount.toString());
    setEditDate(new Date(income.date));
    setEditDescription(income.description || '');
    setEditDialogOpen(true);
  };

  // Add a function to handle the edit submission
  const handleEditIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !editingIncome) return;
    
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
    
    setIsEditing(true);
    
    try {
      // Update the income in the database
      const { error } = await supabase
        .from('income')
        .update({
          amount: amountNum,
          date: editDate.toISOString(),
          description: editDescription || null,
        })
        .eq('id', editingIncome.id)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      // Update the local state
      setIncome(income.map(item => 
        item.id === editingIncome.id 
          ? { 
              ...item, 
              amount: amountNum, 
              date: editDate.toISOString(), 
              description: editDescription || null 
            } 
          : item
      ));
      
      toast({
        title: 'Income updated',
        description: 'Your income has been updated successfully.',
      });
      
      setEditDialogOpen(false);
    } catch (error: any) {
      console.error('Error updating income:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update income. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Income</h1>
          <p className="text-muted-foreground">Add and manage your income sources</p>
        </div>

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
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="e.g., Salary, Freelance work, Gift"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="recurring"
                      checked={recurring}
                      onCheckedChange={(checked) => setRecurring(checked === true)}
                    />
                    <Label htmlFor="recurring">Recurring income</Label>
                  </div>
                  
                  {recurring && (
                    <Select value={frequency} onValueChange={(value: any) => setFrequency(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  <Plus className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Adding..." : "Add Income"}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Income List */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Income History</CardTitle>
                  <CardDescription>
                    Total: {formatCurrency(totalIncome)}
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
              ) : sortedIncome.length > 0 ? (
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
                      {sortedIncome.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{formatDate(item.date)}</TableCell>
                          <TableCell className="text-income">{formatCurrency(item.amount)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.description || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => openEditDialog(item)}
                                className="text-muted-foreground hover:text-primary"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => confirmDelete(item.id)}
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
                  <p className="text-muted-foreground mb-6">No income transactions yet</p>
                  <p className="text-sm text-muted-foreground mb-4">Use the form to add your first income entry</p>
                </div>
              )}
            </CardContent>
          </Card>
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
                disabled={isEditing}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isEditing}
              >
                {isEditing ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default IncomePage;
