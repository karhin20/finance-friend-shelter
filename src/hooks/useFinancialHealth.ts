import { useMemo, useCallback } from 'react';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { RecurringTransaction } from '@/contexts/FinanceContext';
import { Income, Expense } from '@/lib/supabase';

interface UseFinancialHealthProps {
    filteredIncome: Income[];
    filteredExpenses: Expense[];
    recentTransactions: (Income | Expense)[];
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    formatCurrency: (amount: number) => string;
}

export const useFinancialHealth = ({
    filteredIncome,
    filteredExpenses,
    recentTransactions,
    totalIncome,
    totalExpenses,
    balance,
    formatCurrency,
}: UseFinancialHealthProps) => {

    // Financial Health calculations
    const currentMonthStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(new Date());

    const currentMonthIncome = useMemo(() => filteredIncome
        .filter(t => isWithinInterval(new Date(t.date), { start: currentMonthStart, end: currentMonthEnd }))
        .reduce((sum, t) => sum + t.amount, 0), [filteredIncome, currentMonthStart, currentMonthEnd]);

    const currentMonthExpenses = useMemo(() => filteredExpenses
        .filter(t => isWithinInterval(new Date(t.date), { start: currentMonthStart, end: currentMonthEnd }))
        .reduce((sum, t) => sum + t.amount, 0), [filteredExpenses, currentMonthStart, currentMonthEnd]);

    const currentMonthSavings = currentMonthIncome - currentMonthExpenses;

    const savingsRatio = currentMonthIncome > 0 ? (currentMonthSavings / currentMonthIncome) * 100 : 0;

    const categories = useMemo(() => filteredExpenses.map(e => e.category), [filteredExpenses]);
    const uniqueCategories = new Set(categories).size;
    const categoryDiversity = uniqueCategories > 0 ? Math.min(uniqueCategories / 5, 1) * 100 : 0;

    const oldestTransactionDate = useMemo(() => {
        if (recentTransactions.length === 0) return new Date();
        try {
            // @ts-ignore - type intersection issue with date string/date object, safe to cast/assume here for calculation
            return new Date(Math.min(...recentTransactions.map(t => new Date(t.date).getTime())));
        } catch { return new Date(); }
    }, [recentTransactions]);

    const daysSinceFirst = Math.max(1, Math.floor((new Date().getTime() - oldestTransactionDate.getTime()) / (1000 * 60 * 60 * 24)));
    const avgTransactionsPerDay = recentTransactions.length / daysSinceFirst;
    const consistencyScore = Math.min(avgTransactionsPerDay * 10, 100);

    const getFinancialHealthStatus = useCallback(() => {
        // Recalculate health score with more balanced weights
        // New scoring system:
        // - Savings Rate: 40% (important but not overwhelming)
        // - Spending Control: 30% (whether you're living within means)
        // - Consistency: 20% (regular tracking)
        // - Category Diversity: 10% (nice to have for insights)

        // Calculate spending control score (0-100)
        // Rewards positive balance, penalizes overspending
        let spendingControlScore = 0;
        if (totalIncome > 0) {
            const balanceRatio = balance / totalIncome;
            if (balanceRatio >= 0.3) {
                spendingControlScore = 100; // Saving 30%+ is excellent
            } else if (balanceRatio >= 0) {
                spendingControlScore = (balanceRatio / 0.3) * 100; // Scale 0-30% savings to 0-100 score
            } else {
                // Penalize overspending more heavily
                spendingControlScore = Math.max(0, 50 + (balanceRatio * 100)); // -50% overspending = 0 score
            }
        }

        const weights = { savings: 0.40, spendingControl: 0.30, consistency: 0.20, diversity: 0.10 };
        const healthScore = (savingsRatio * weights.savings) +
            (spendingControlScore * weights.spendingControl) +
            (consistencyScore * weights.consistency) +
            (categoryDiversity * weights.diversity);

        let status = 'poor';
        let message = "Consider reviewing your financial habits.";

        if (healthScore >= 75) {
            status = 'excellent';
            message = "Excellent! You're saving well and managing your finances effectively.";
        } else if (healthScore >= 55) {
            status = 'good';
            message = "Good! You're on the right track with your financial management.";
        } else if (healthScore >= 35) {
            status = 'fair';
            message = "You're making progress, but there's room for improvement.";
        }

        // Provide tailored, actionable advice based on financial behavior
        const advice: string[] = [];

        // CRITICAL: Spending exceeds income
        if (totalExpenses > totalIncome) {
            const deficit = totalExpenses - totalIncome;
            advice.push(`🚨 Critical: You're spending ${formatCurrency(deficit)} more than you earn. Cut non-essential expenses immediately.`);
        }

        // URGENT: Negative savings this month
        if (currentMonthSavings < 0 && totalExpenses <= totalIncome) {
            advice.push(`⚠️ This month's expenses (${formatCurrency(currentMonthExpenses)}) exceed income (${formatCurrency(currentMonthIncome)}). Review and adjust spending.`);
        }

        // Savings rate analysis with specific targets
        if (savingsRatio < 10 && totalIncome > 0) {
            advice.push(`💰 Your savings rate is ${Math.round(savingsRatio)}%. Start with a goal to save at least 10-15% monthly, then work toward 20%.`);
        } else if (savingsRatio < 20 && savingsRatio >= 10) {
            advice.push(`💰 Good start! You're saving ${Math.round(savingsRatio)}%. Try increasing to 20% by reducing one recurring expense.`);
        } else if (savingsRatio >= 20 && savingsRatio < 30) {
            advice.push(`🎯 Excellent! You're saving ${Math.round(savingsRatio)}%. Consider increasing to 30% if possible for faster wealth building.`);
        }

        // Category diversity insights
        if (uniqueCategories < 3 && filteredExpenses.length > 0) {
            advice.push(`📊 You're only tracking ${uniqueCategories} expense ${uniqueCategories === 1 ? 'category' : 'categories'}. Break down expenses (Food, Transport, Bills, Entertainment, etc.) for better insights.`);
        }


        // Top spending category analysis (calculate inline to avoid dependency issues)
        const localTopExpenses = filteredExpenses.reduce((acc, item) => {
            const key = item.category || 'Uncategorized';
            acc[key] = (acc[key] || 0) + item.amount;
            return acc;
        }, {} as Record<string, number>);
        const topExpensesArray = Object.entries(localTopExpenses)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount);

        if (topExpensesArray.length > 0 && totalExpenses > 0) {
            const topCategory = topExpensesArray[0];
            const topPercentage = (topCategory.amount / totalExpenses) * 100;
            if (topPercentage > 40) {
                advice.push(`📈 ${topCategory.name} accounts for ${Math.round(topPercentage)}% of spending (${formatCurrency(topCategory.amount)}). Look for ways to reduce this category.`);
            }
        }

        // Transaction logging consistency
        if (avgTransactionsPerDay < 0.3 && filteredExpenses.length < 10) {
            advice.push(`✍️ Log transactions daily for accurate tracking. Even small purchases add up and impact your budget.`);
        }

        // Emergency fund recommendation (if savings are positive)
        if (savingsRatio > 10 && currentMonthSavings > 0) {
            const emergencyFundGoal = currentMonthExpenses * 3; // 3 months of expenses
            if (currentMonthSavings < emergencyFundGoal) {
                advice.push(`🛡️ Build an emergency fund covering 3-6 months of expenses (Target: ${formatCurrency(emergencyFundGoal)}). Save ${formatCurrency((emergencyFundGoal / 12))} monthly.`);
            }
        }

        // Income growth suggestions
        if (totalIncome < totalExpenses * 1.2 && totalIncome > 0) {
            advice.push(`📈 Your income should ideally be 20%+ above expenses. Consider side hustles or additional income streams.`);
        }

        // Positive reinforcement for good behavior
        if (savingsRatio >= 30) {
            advice.push(`🌟 Outstanding! You're saving ${Math.round(savingsRatio)}%. You're building wealth effectively. Keep it up!`);
        }

        // Budget balance check
        const budgetHealthRatio = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;
        if (budgetHealthRatio > 50 && balance > 0) {
            advice.push(`✅ You're saving over 50% of your income! Consider investing excess savings for long-term growth.`);
        }

        // Default positive message if everything is great
        if (advice.length === 0 || (healthScore >= 70 && advice.length < 2)) {
            advice.push(`🎉 Great financial management! Your habits are strong. Continue tracking and growing your wealth.`);
        }

        return {
            status,
            message,
            score: Math.round(healthScore),
            advice: advice.slice(0, 5) // Limit to top 5 most relevant suggestions
        };
    }, [savingsRatio, categoryDiversity, consistencyScore, totalIncome, totalExpenses, currentMonthSavings, currentMonthIncome, currentMonthExpenses, filteredExpenses, formatCurrency, avgTransactionsPerDay, balance, uniqueCategories]);

    return useMemo(getFinancialHealthStatus, [getFinancialHealthStatus]);
};
