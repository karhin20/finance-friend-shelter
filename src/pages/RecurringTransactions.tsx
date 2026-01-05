import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useFinance, RecurringTransaction } from '@/contexts/FinanceContext'; // Import interface
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns'; // Use parseISO for date strings
import { formatCurrency, formatDate } from '@/lib/supabase'; // Use existing formatters
import { cn } from '@/lib/utils';
import { CalendarIcon, Pencil, Trash2, Play, Pause, AlertCircle, Ban } from 'lucide-react';
import { Badge } from '@/components/ui/badge'; // For status display

const RecurringTransactionsPage = () => {
    const { toast } = useToast();
    const {
        recurringTransactionsQuery,
        updateRecurringTransactionMutation,
        deleteRecurringTransactionMutation,
        categoriesQuery // Needed for category dropdowns in edit
    } = useFinance();

    const { data: rules = [], isLoading, isError, error } = recurringTransactionsQuery;
    const { data: allCategories = [], isLoading: isLoadingCategories } = categoriesQuery;

    // Edit state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<RecurringTransaction | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [editFrequency, setEditFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
    const [editStartDate, setEditStartDate] = useState<Date | undefined>(undefined);
    const [editNextDueDate, setEditNextDueDate] = useState<Date | undefined>(undefined);
    const [editEndDate, setEditEndDate] = useState<Date | null | undefined>(undefined); // Allow null/undefined
    const [editDescription, setEditDescription] = useState('');
    const [editIsActive, setEditIsActive] = useState(true);
    const [editType, setEditType] = useState<'income' | 'expense'>('expense'); // Store type for category filtering

    // Delete state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);

    // Filter categories based on edit type
    const relevantCategories = useMemo(() => {
        return allCategories.filter(c => c.type === editType);
    }, [allCategories, editType]);

    const openEditDialog = (rule: RecurringTransaction) => {
        setEditingRule(rule);
        setEditType(rule.type); // Set type first for category filtering
        setEditAmount(rule.amount.toString());
        setEditCategory(rule.category || '');
        setEditFrequency(rule.frequency);
        setEditStartDate(rule.start_date ? parseISO(rule.start_date) : undefined);
        setEditNextDueDate(rule.next_due_date ? parseISO(rule.next_due_date) : undefined);
        setEditEndDate(rule.end_date ? parseISO(rule.end_date) : null); // Handle null end date
        setEditDescription(rule.description || '');
        setEditIsActive(rule.is_active);
        setEditDialogOpen(true);
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRule) return;

        const amountNum = parseFloat(editAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            toast({ title: "Invalid Amount", variant: "destructive" });
            return;
        }
        if (!editCategory) {
            toast({ title: "Category Required", variant: "destructive" });
            return;
        }
        if (!editStartDate || !editNextDueDate) {
             toast({ title: "Dates Required", description: "Start and Next Due Date are mandatory.", variant: "destructive" });
             return;
        }


        updateRecurringTransactionMutation.mutate({
            id: editingRule.id,
            updates: {
                amount: amountNum,
                category: editCategory,
                frequency: editFrequency,
                start_date: format(editStartDate, 'yyyy-MM-dd'),
                next_due_date: format(editNextDueDate, 'yyyy-MM-dd'),
                end_date: editEndDate ? format(editEndDate, 'yyyy-MM-dd') : null, // Send null if cleared
                description: editDescription.trim() || null,
                is_active: editIsActive,
                // Type cannot be changed easily as it affects target table
            }
        }, {
            onSuccess: () => {
                setEditDialogOpen(false);
                toast({ title: "Rule Updated" });
            },
            onError: (err) => {
                toast({ title: "Update Failed", description: err.message, variant: "destructive" });
            }
        });
    };

    const handleToggleActive = (rule: RecurringTransaction) => {
        updateRecurringTransactionMutation.mutate({
            id: rule.id,
            updates: { is_active: !rule.is_active }
        }, {
            onSuccess: () => {
                toast({ title: rule.is_active ? "Rule Paused" : "Rule Resumed" });
            },
            onError: (err) => {
                toast({ title: "Action Failed", description: err.message, variant: "destructive" });
            }
        });
    };

    const confirmDelete = (id: string) => {
        setRuleToDelete(id);
        setDeleteDialogOpen(true);
    };

    const handleDelete = () => {
        if (!ruleToDelete) return;
        deleteRecurringTransactionMutation.mutate(ruleToDelete, {
            onSuccess: () => {
                setDeleteDialogOpen(false);
                toast({ title: "Rule Deleted" });
            },
            onError: (err) => {
                toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
            }
        });
    };


    return (
        <DashboardLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Manage Recurring Transactions</h1>
                    <p className="text-muted-foreground">View, edit, pause, or delete your recurring income and expense rules.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Recurring Rules</CardTitle>
                        <CardDescription>All your saved recurring transaction rules.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <p>Loading rules...</p>
                        ) : isError ? (
                            <div className="text-destructive flex items-center gap-2">
                                <AlertCircle className="h-5 w-5" /> Error loading rules: {error?.message}
                            </div>
                        ) : rules.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">No recurring transaction rules found. Add them via the Income or Expenses page.</p>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead>Frequency</TableHead>
                                            <TableHead>Next Due</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rules.map((rule) => (
                                            <TableRow key={rule.id}>
                                                <TableCell>
                                                    <Badge variant={rule.is_active ? "default" : "outline"} className={rule.is_active ? "bg-green-100 text-green-800" : ""}>
                                                        {rule.is_active ? "Active" : "Paused"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className={`capitalize font-medium ${rule.type === 'income' ? 'text-income' : 'text-expense'}`}>
                                                    {rule.type}
                                                </TableCell>
                                                <TableCell>{formatCurrency(rule.amount)}</TableCell>
                                                <TableCell>{rule.category || '-'}</TableCell>
                                                <TableCell className="capitalize">{rule.frequency}</TableCell>
                                                <TableCell>{formatDate(rule.next_due_date)}</TableCell>
                                                <TableCell className="text-muted-foreground max-w-[150px] truncate" title={rule.description || ''}>
                                                    {rule.description || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex space-x-1">
                                                        <Button
                                                            variant="ghost" size="icon" title="Edit"
                                                            onClick={() => openEditDialog(rule)}
                                                            disabled={updateRecurringTransactionMutation.isLoading || deleteRecurringTransactionMutation.isLoading}
                                                        > <Pencil className="h-4 w-4" /> </Button>
                                                        <Button
                                                            variant="ghost" size="icon"
                                                            title={rule.is_active ? "Pause" : "Resume"}
                                                            onClick={() => handleToggleActive(rule)}
                                                            disabled={updateRecurringTransactionMutation.isLoading || deleteRecurringTransactionMutation.isLoading}
                                                        > {rule.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} </Button>
                                                        <Button
                                                            variant="ghost" size="icon" title="Delete"
                                                            onClick={() => confirmDelete(rule.id)}
                                                            className="text-destructive hover:text-destructive"
                                                            disabled={updateRecurringTransactionMutation.isLoading || deleteRecurringTransactionMutation.isLoading}
                                                        > <Trash2 className="h-4 w-4" /> </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Edit Recurring Rule ({editingRule?.type})</DialogTitle>
                        <DialogDescription>Modify the details of this recurring transaction rule.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="grid gap-4 py-4">
                        {/* Amount */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-amount" className="text-right">Amount</Label>
                            <Input id="edit-amount" type="number" step="0.01" min="0" value={editAmount} onChange={e => setEditAmount(e.target.value)} required className="col-span-3" />
                        </div>
                        {/* Category */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-category" className="text-right">Category</Label>
                            <Select value={editCategory} onValueChange={setEditCategory} required disabled={isLoadingCategories}>
                                <SelectTrigger id="edit-category" className="col-span-3">
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {relevantCategories.map(cat => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Frequency */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-frequency" className="text-right">Frequency</Label>
                            <Select value={editFrequency} onValueChange={(v: any) => setEditFrequency(v)} required>
                                <SelectTrigger id="edit-frequency" className="col-span-3"> <SelectValue /> </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="yearly">Yearly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Start Date */}
                        <div className="grid grid-cols-4 items-center gap-4">
                             <Label htmlFor="edit-start-date" className="text-right">Start Date</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" id="edit-start-date" className={cn("col-span-3 justify-start text-left font-normal", !editStartDate && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" /> {editStartDate ? format(editStartDate, "PPP") : <span>Pick start date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={editStartDate} onSelect={setEditStartDate} initialFocus /></PopoverContent>
                             </Popover>
                        </div>
                         {/* Next Due Date */}
                        <div className="grid grid-cols-4 items-center gap-4">
                             <Label htmlFor="edit-next-due-date" className="text-right">Next Due</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" id="edit-next-due-date" className={cn("col-span-3 justify-start text-left font-normal", !editNextDueDate && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" /> {editNextDueDate ? format(editNextDueDate, "PPP") : <span>Pick next due date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={editNextDueDate} onSelect={setEditNextDueDate} initialFocus /></PopoverContent>
                             </Popover>
                        </div>
                         {/* End Date */}
                        <div className="grid grid-cols-4 items-center gap-4">
                             <Label htmlFor="edit-end-date" className="text-right">End Date</Label>
                             <div className="col-span-3 flex items-center gap-2">
                                 <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" id="edit-end-date" className={cn("flex-grow justify-start text-left font-normal", !editEndDate && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" /> {editEndDate ? format(editEndDate, "PPP") : <span>No end date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={editEndDate || undefined} onSelect={(d) => setEditEndDate(d || null)} /></PopoverContent>
                                 </Popover>
                                 {editEndDate && <Button variant="ghost" size="icon" onClick={() => setEditEndDate(null)} title="Clear end date"><Ban className="h-4 w-4"/></Button>}
                             </div>
                        </div>
                        {/* Description */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-description" className="text-right">Description</Label>
                            <Textarea id="edit-description" value={editDescription} onChange={e => setEditDescription(e.target.value)} className="col-span-3" placeholder="Optional description" />
                        </div>
                        {/* Status (Is Active) - Can be toggled from main table, maybe not needed here? Or keep for completeness */}
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-is_active" className="text-right">Status</Label>
                            <Select value={editIsActive ? "active" : "paused"} onValueChange={(v) => setEditIsActive(v === "active")} >
                                <SelectTrigger id="edit-is_active" className="col-span-3"> <SelectValue /> </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="paused">Paused</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setEditDialogOpen(false)} disabled={updateRecurringTransactionMutation.isLoading}>Cancel</Button>
                            <Button type="submit" disabled={updateRecurringTransactionMutation.isLoading}>
                                {updateRecurringTransactionMutation.isLoading ? "Saving..." : "Save Changes"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Recurring Rule?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this recurring rule? This action cannot be undone and will stop future transactions from being generated by this rule.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteRecurringTransactionMutation.isLoading}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleteRecurringTransactionMutation.isLoading}>
                            {deleteRecurringTransactionMutation.isLoading ? "Deleting..." : "Delete Rule"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </DashboardLayout>
    );
};

export default RecurringTransactionsPage; 