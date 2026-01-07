import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useCurrency } from '@/contexts/CurrencyContext';
import { format } from 'date-fns';

// Define a minimal type for Saving to avoid circular deps or re-definitions
// Ideally import this from a shared types file, but for now matching the shape expected
interface Saving {
    id: string;
    title: string;
    amount: number;
    goal_amount: number | null;
    target_date?: string | null;
}

interface AddFundsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    saving: Saving | null;
    onSubmit: (amount: number, deductFromBalance: boolean) => Promise<void>;
    isSubmitting: boolean;
}

export const AddFundsDialog = ({ open, onOpenChange, saving, onSubmit, isSubmitting }: AddFundsDialogProps) => {
    const { formatCurrency } = useCurrency();
    const [amount, setAmount] = useState('');
    const [deductFromBalance, setDeductFromBalance] = useState(false);

    // Reset state when dialog opens or saving changes
    useEffect(() => {
        if (open) {
            setAmount('');
            setDeductFromBalance(false);
        }
    }, [open, saving]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const val = parseFloat(amount);
        if (!isNaN(val) && val > 0) {
            onSubmit(val, deductFromBalance);
        }
    };

    if (!saving) return null;

    const progress = saving.goal_amount && saving.goal_amount > 0
        ? Math.min(100, Math.max(0, (saving.amount / saving.goal_amount) * 100))
        : 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Funds to "{saving.title}"</DialogTitle>
                    <DialogDescription>Increase the saved amount for this goal.</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-2">
                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-xl border border-border/50">
                            <div>
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Current</Label>
                                <div className="text-lg font-bold font-mono">{formatCurrency(saving.amount)}</div>
                            </div>
                            {saving.goal_amount && (
                                <div>
                                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Goal</Label>
                                    <div className="text-lg font-bold font-mono text-muted-foreground">{formatCurrency(saving.goal_amount)}</div>
                                </div>
                            )}
                        </div>

                        {/* Progress Bar */}
                        {saving.goal_amount && (
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs">
                                    <span className="font-medium">Progress</span>
                                    <span className="text-muted-foreground">
                                        {progress.toFixed(1)}%
                                        {saving.target_date && ` • Target: ${format(new Date(saving.target_date), 'MMM d, yyyy')}`}
                                    </span>
                                </div>
                                <Progress value={progress} className="h-2 rounded-full" />
                            </div>
                        )}

                        {/* Input Field */}
                        <div className="space-y-2 pt-2">
                            <Label htmlFor="addAmount" className="font-bold">Amount to Add</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                                <Input
                                    id="addAmount"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    autoFocus
                                    className="pl-7 font-bold text-lg h-12"
                                />
                            </div>
                        </div>

                        {/* Checkbox */}
                        <div className="flex items-center space-x-2 bg-muted/30 p-3 rounded-lg border border-border/30">
                            <Checkbox
                                id="deductFunds"
                                checked={deductFromBalance}
                                onCheckedChange={(checked) => setDeductFromBalance(checked === true)}
                            />
                            <Label htmlFor="deductFunds" className="text-sm font-medium cursor-pointer">
                                Deduct from balance (create expense)
                            </Label>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 mt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting || !amount || parseFloat(amount) <= 0} className="font-bold shadow-md shadow-primary/10">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isSubmitting ? "Adding..." : "Add Funds"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
