import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/supabase';

interface BudgetProgressProps {
  category: string;
  spent: number;
  budgeted: number;
}

export function BudgetProgress({ category, spent, budgeted }: BudgetProgressProps) {
  const percentage = Math.min((spent / budgeted) * 100, 100);
  const remaining = budgeted - spent;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="font-medium">{category}</span>
        <span className={remaining >= 0 ? 'text-muted-foreground' : 'text-destructive'}>
          {formatCurrency(spent)} / {formatCurrency(budgeted)}
        </span>
      </div>
      <Progress 
        value={percentage} 
        className={`h-2 ${remaining < 0 ? 'bg-destructive/20' : ''}`} 
      />
      <p className="text-xs text-muted-foreground">
        {remaining >= 0 
          ? `${formatCurrency(remaining)} remaining` 
          : `${formatCurrency(Math.abs(remaining))} over budget`}
      </p>
    </div>
  );
} 