import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

export type SavingFormData = {
    title: string;
    amount: string;
    goalAmount: string;
    date: Date;
    targetDate?: Date;
    description: string;
    deductFromBalance: boolean;
};

interface SavingsFormProps {
    mode: 'add' | 'edit';
    initialData?: any; // Using any for flexibility, similar to previous implementation
    onSubmit: (data: SavingFormData) => Promise<void>;
    isSubmitting: boolean;
    onCancel?: () => void;
}

export const SavingsForm = ({ mode, initialData, onSubmit, isSubmitting, onCancel }: SavingsFormProps) => {
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [goalAmount, setGoalAmount] = useState('');
    const [date, setDate] = useState<Date>(new Date());
    const [targetDate, setTargetDate] = useState<Date | undefined>(undefined);
    const [description, setDescription] = useState('');
    const [deductFromBalance, setDeductFromBalance] = useState(false);

    useEffect(() => {
        if (mode === 'edit' && initialData) {
            setTitle(initialData.title || '');
            setAmount(String(initialData.amount || 0));
            setGoalAmount(String(initialData.goal_amount || ''));
            setDate(initialData.date ? new Date(initialData.date) : new Date());
            setTargetDate(initialData.target_date ? new Date(initialData.target_date) : undefined);
            setDescription(initialData.description || '');
        } else {
            setTitle('');
            setAmount('');
            setGoalAmount('');
            setDate(new Date());
            setTargetDate(undefined);
            setDescription('');
            setDeductFromBalance(false);
        }
    }, [mode, initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ title, amount, goalAmount, date, targetDate, description, deductFromBalance });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="title">Goal Title</Label>
                <Input
                    id="title"
                    placeholder="e.g., New Car, Vacation"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="font-bold text-lg"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="amount">{mode === 'edit' ? 'Current Amount' : 'Initial Amount'}</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="pl-7 font-mono font-bold"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="goalAmount">Target Goal (Optional)</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                        <Input
                            id="goalAmount"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={goalAmount}
                            onChange={(e) => setGoalAmount(e.target.value)}
                            className="pl-7 font-mono"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(date, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="space-y-2">
                    <Label>Target Date (Optional)</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn("w-full justify-start text-left font-normal", !targetDate && "text-muted-foreground")}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {targetDate ? format(targetDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={targetDate} onSelect={setTargetDate} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                    id="description"
                    placeholder="Why are you saving for this?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="resize-none"
                />
            </div>

            {mode === 'add' && (
                <div className="flex items-center space-x-2 pt-2 border-t">
                    <Checkbox
                        id="deduct"
                        checked={deductFromBalance}
                        onCheckedChange={(c) => setDeductFromBalance(c === true)}
                    />
                    <Label htmlFor="deduct" className="cursor-pointer">
                        Deduct initial amount from balance (create expense)
                    </Label>
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
                {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                        Cancel
                    </Button>
                )}
                <Button type="submit" disabled={isSubmitting} className="min-w-[120px] font-bold shadow-lg shadow-primary/20">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    {mode === 'add' ? 'Create Goal' : 'Save Changes'}
                </Button>
            </div>
        </form>
    );
};
