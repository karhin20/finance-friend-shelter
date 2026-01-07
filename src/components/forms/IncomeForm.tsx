import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { format, addWeeks, addMonths, addYears } from 'date-fns';
import { CalendarIcon, Plus, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useFinance } from '@/contexts/FinanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Category } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

// Helper for recurring calculation
const calculateNextOccurrence = (startDate: Date, frequency: 'weekly' | 'monthly' | 'yearly'): Date => {
    switch (frequency) {
        case 'weekly': return addWeeks(startDate, 1);
        case 'monthly': return addMonths(startDate, 1);
        case 'yearly': return addYears(startDate, 1);
        default: return startDate;
    }
};

interface IncomeFormProps {
    onSuccess?: () => void;
    className?: string;
}

export const IncomeForm = ({ onSuccess, className }: IncomeFormProps) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const {
        categoriesQuery,
        addIncomeMutation,
        updateIncomeMutation // Included for completeness of loading state checks if needed, though this form is for ADD only
    } = useFinance();

    const { data: allCategories = [], isLoading: isLoadingCategories } = categoriesQuery;
    const incomeCategories = allCategories.filter(c => c.type === 'income');

    // Form State
    const [amount, setAmount] = useState<string>('');
    const [date, setDate] = useState<Date>(new Date());
    const [source, setSource] = useState<string>('');
    const [description, setDescription] = useState<string>('');

    // Recurring State
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
    const [createInitialTransaction, setCreateInitialTransaction] = useState(true);

    // Suggestions
    const suggestions = [
        { label: 'Salary', category: 'Salary', icon: '💼', color: 'text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-200' },
        { label: 'Freelance', category: 'Freelance', icon: '💻', color: 'text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 border-blue-200' },
        { label: 'Gifts', category: 'Gifts', icon: '🎁', color: 'text-pink-500 bg-pink-500/10 hover:bg-pink-500/20 border-pink-200' },
        { label: 'Interest', category: 'Interest', icon: '📈', color: 'text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 border-amber-200' },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !date || !source || !user) {
            toast({ title: "Missing Fields", description: "Amount, Date, and Source are required.", variant: "destructive" });
            return;
        }
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            toast({ title: "Invalid Amount", description: "Please enter a valid positive amount.", variant: "destructive" });
            return;
        }

        const selectedCategory = incomeCategories.find(cat => cat.name === source);
        if (!selectedCategory) {
            toast({ title: "Category Error", description: "Selected category not found in your list.", variant: "destructive" });
            return;
        }

        if (isRecurring) {
            const startDateForRule = date;
            const nextDueDateForDb = createInitialTransaction
                ? calculateNextOccurrence(startDateForRule, frequency)
                : startDateForRule;

            try {
                const { error: recurringError } = await supabase.from('recurring_transactions').insert([{
                    user_id: user.id,
                    type: 'income',
                    amount: amountNum,
                    category: source,
                    description: description.trim() || null,
                    frequency: frequency,
                    start_date: format(startDateForRule, 'yyyy-MM-dd'),
                    next_due_date: format(nextDueDateForDb, 'yyyy-MM-dd'),
                    is_active: true
                }]);
                if (recurringError) throw recurringError;

                toast({ title: "Recurring Income Saved", description: `Rule added: ${frequency} payments.` });

                if (createInitialTransaction) {
                    addIncomeMutation.mutate({
                        amount: amountNum,
                        date: startDateForRule.toISOString(),
                        category: source,
                        description: description.trim() || null,
                    }, {
                        onSuccess: () => {
                            toast({ title: "Transaction Added", description: "Initial income recorded." });
                            resetForm();
                            onSuccess?.();
                        },
                        onError: (error: any) => {
                            toast({ title: "Error", description: `Failed to add initial transaction: ${error.message}`, variant: "destructive" });
                        }
                    });
                } else {
                    resetForm();
                    onSuccess?.();
                }
            } catch (error: any) {
                console.error("Error saving recurring income:", error);
                toast({ title: "Error", description: `Failed to save rule: ${error.message}`, variant: "destructive" });
            }
        } else {
            addIncomeMutation.mutate({
                amount: amountNum,
                date: date.toISOString(),
                category: source,
                description: description.trim() || null,
            }, {
                onSuccess: () => {
                    toast({ title: "Income Added", description: "Transaction recorded successfully." });
                    resetForm();
                    onSuccess?.();
                },
                onError: (error: any) => {
                    toast({ title: "Error", description: error.message, variant: "destructive" });
                }
            });
        }
    };

    const resetForm = () => {
        setAmount('');
        setDate(new Date());
        setSource('');
        setDescription('');
        setIsRecurring(false);
        setFrequency('monthly');
        setCreateInitialTransaction(true);
    };

    const isLoading = addIncomeMutation.isLoading || updateIncomeMutation.isLoading;

    return (
        <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
            <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Suggestions</Label>
                <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => (
                        <Button
                            key={suggestion.label}
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn("h-7 text-xs px-2.5 py-0.5 rounded-full transition-colors border", suggestion.color)}
                            onClick={() => {
                                setDescription(suggestion.label);
                                const foundCat = incomeCategories.find(c =>
                                    c.name.toLowerCase() === suggestion.category.toLowerCase() ||
                                    c.name.toLowerCase().includes(suggestion.label.toLowerCase())
                                );
                                if (foundCat) setSource(foundCat.name);
                            }}
                        >
                            <span className="mr-1.5">{suggestion.icon}</span>
                            {suggestion.label}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label htmlFor="amount">Amount</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="pl-7 font-bold text-lg"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>
                </div>

                <div className="space-y-2 col-span-2 sm:col-span-1">
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
                        <SelectValue placeholder={isLoadingCategories ? "Loading..." : "Select source"} />
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
                    placeholder="e.g., Salary, Freelance work"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="resize-none"
                />
            </div>

            <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="recurring-income-modal"
                        checked={isRecurring}
                        onCheckedChange={(checked) => {
                            setIsRecurring(checked === true);
                            if (checked !== true) setCreateInitialTransaction(true);
                        }}
                        disabled={incomeCategories.length === 0}
                    />
                    <Label htmlFor="recurring-income-modal" className="font-medium cursor-pointer">Set as Recurring?</Label>
                </div>

                {isRecurring && (
                    <div className="space-y-4 pl-6 pt-2 animate-in slide-in-from-top-2 duration-300">
                        <div>
                            <Label htmlFor="frequency-income-modal">Frequency</Label>
                            <Select value={frequency} onValueChange={(v: any) => setFrequency(v)} required={isRecurring}>
                                <SelectTrigger id="frequency-income-modal" className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="yearly">Yearly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="create-initial-income-modal"
                                checked={createInitialTransaction}
                                onCheckedChange={(checked) => setCreateInitialTransaction(checked === true)}
                            />
                            <Label htmlFor="create-initial-income-modal" className="text-sm font-normal cursor-pointer">Add first transaction now?</Label>
                        </div>
                    </div>
                )}
            </div>

            <Button
                type="submit"
                className="w-full h-12 font-bold text-base rounded-xl mt-4"
                disabled={isLoading || incomeCategories.length === 0}
            >
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Plus className="mr-2 h-5 w-5" />}
                {isRecurring ? (createInitialTransaction ? "Save Rule & Add Initial" : "Save Recurring Rule") : "Add Income"}
            </Button>
        </form>
    );
};
