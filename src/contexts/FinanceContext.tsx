import { createContext, useContext, useState, useMemo, useEffect, Dispatch, SetStateAction, useRef, ReactNode } from 'react';
import { supabase, Income, Expense, Category } from '@/lib/supabase'; // Assuming types are here
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PostgrestError } from '@supabase/supabase-js';
import {
    useQuery,
    useMutation,
    useQueryClient,
    QueryKey,
    UseQueryResult,
    UseMutationResult
} from '@tanstack/react-query';
import { startOfMonth, endOfMonth, format } from 'date-fns'; // For default date range

// --- Types ---

// Filter type (start simple, can be expanded)
interface DateRangeFilter {
    from: Date | null;
    to: Date | null;
}

interface FinanceFilters {
    dateRange: DateRangeFilter;
    // Add other potential filters here (e.g., categoryFilter: string | null)
}

// Type for the mutation functions provided by the context
// These include the mutate function and status flags from useMutation
type FinanceMutation<TData, TVariables> = {
    mutate: (variables: TVariables, options?: any) => void;
    mutateAsync: (variables: TVariables, options?: any) => Promise<TData>;
    isLoading: boolean;
    isError: boolean;
    error: unknown | null;
    // Add other useMutation result fields if needed (isSuccess, data, etc.)
};

interface FinanceContextType {
    user: any;
    filters: FinanceFilters;
    setFilters: Dispatch<SetStateAction<FinanceFilters>>;
    incomeQuery: UseQueryResult<Income[], Error>;
    expensesQuery: UseQueryResult<Expense[], Error>;
    categoriesQuery: UseQueryResult<Category[], Error>;
    recurringTransactionsQuery: UseQueryResult<RecurringTransaction[], Error>;
    addIncomeMutation: any;
    updateIncomeMutation: any;
    deleteIncomeMutation: any;
    addExpenseMutation: any;
    updateExpenseMutation: any;
    deleteExpenseMutation: any;
    addCategoryMutation: any;
    addDefaultCategoriesMutation: any;
    updateCategoryMutation: any;
    deleteCategoryMutation: any;
    createRecurringTransactionMutation: any;
    updateRecurringTransactionMutation: any;
    deleteRecurringTransactionMutation: any;
}

// --- Context ---
const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

// --- Helper: Define Query Keys ---
const financeKeys = {
    all: ['finance'] as const,
    income: (userId: string | undefined, filters?: FinanceFilters) => [...financeKeys.all, 'income', { userId, filters }] as const,
    expenses: (userId: string | undefined, filters?: FinanceFilters) => [...financeKeys.all, 'expenses', { userId, filters }] as const,
    categories: (userId: string | undefined) => [...financeKeys.all, 'categories', { userId }] as const,
};

// --- Standalone Fetch Functions ---
const fetchIncomeData = async (userId: string, filters?: FinanceFilters): Promise<Income[]> => {
    let query = supabase
        .from('income')
        .select('*')
        .eq('user_id', userId);

    // Apply Date Filter
    if (filters?.dateRange?.from) {
        query = query.gte('date', filters.dateRange.from.toISOString());
    }
    if (filters?.dateRange?.to) {
        // Adjust 'to' date to include the whole day
        const toDate = new Date(filters.dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('date', toDate.toISOString());
    } else if (filters?.dateRange?.from && !filters?.dateRange?.to) {
        // If only 'from' is set, maybe fetch up to today? Or handle as needed.
        // For now, we fetch >= from date
    }

    query = query.order('date', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

const fetchExpensesData = async (userId: string, filters?: FinanceFilters): Promise<Expense[]> => {
    let query = supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId);

    // Apply Date Filter (same logic as income)
    if (filters?.dateRange?.from) {
        query = query.gte('date', filters.dateRange.from.toISOString());
    }
    if (filters?.dateRange?.to) {
        const toDate = new Date(filters.dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('date', toDate.toISOString());
    }

    query = query.order('date', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

const fetchCategoriesData = async (userId: string): Promise<Category[]> => {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true }); // Order alphabetically
    if (error) throw error;
    return data || [];
};

// --- Add RecurringTransaction Interface ---
export interface RecurringTransaction {
    id: string;
    created_at: string;
    user_id: string;
    type: 'income' | 'expense';
    amount: number;
    category: string | null; // Using text category based on previous discussion
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    start_date: string; // ISO date string YYYY-MM-DD
    next_due_date: string; // ISO date string YYYY-MM-DD
    end_date?: string | null; // ISO date string YYYY-MM-DD
    description?: string | null;
    is_active: boolean;
}

// Type for updating recurring transactions
type RecurringTransactionUpdates = Partial<Omit<RecurringTransaction, 'id' | 'created_at' | 'user_id'>>;

// --- Provider ---
export const FinanceProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient(); // Get query client instance

    // State for filters
    const [filters, setFilters] = useState<FinanceFilters>({
        dateRange: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
    });

    // --- Queries ---
    const incomeQuery = useQuery<Income[]>({
        queryKey: ['income', filters.dateRange.from?.toISOString(), filters.dateRange.to?.toISOString()],
        queryFn: async () => {
            if (!user || !filters.dateRange.from || !filters.dateRange.to) return [];
            console.log(`Fetching income from ${filters.dateRange.from.toISOString()} to ${filters.dateRange.to.toISOString()} `); // Debug log
            const { data, error } = await supabase
                .from('income')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', filters.dateRange.from.toISOString()) // Apply start date filter
                .lte('date', filters.dateRange.to.toISOString())   // Apply end date filter
                .order('date', { ascending: false });
            if (error) {
                console.error("Error fetching income:", error);
                throw error;
            }
            return (data as Income[]) || [];
        },
        enabled: !!user && !!filters.dateRange.from && !!filters.dateRange.to, // Only run if user and dates are set
        placeholderData: (previousData) => previousData,
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });

    const expensesQuery = useQuery<Expense[]>({
        queryKey: ['expenses', filters.dateRange.from?.toISOString(), filters.dateRange.to?.toISOString()],
        queryFn: async () => {
            if (!user || !filters.dateRange.from || !filters.dateRange.to) return [];
            console.log(`Fetching expenses from ${filters.dateRange.from.toISOString()} to ${filters.dateRange.to.toISOString()} `); // Debug log
            const { data, error } = await supabase
                .from('expenses')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', filters.dateRange.from.toISOString()) // Apply start date filter
                .lte('date', filters.dateRange.to.toISOString())   // Apply end date filter
                .order('date', { ascending: false });
            if (error) {
                console.error("Error fetching expenses:", error);
                throw error;
            }
            return (data as Expense[]) || [];
        },
        enabled: !!user && !!filters.dateRange.from && !!filters.dateRange.to, // Only run if user and dates are set
        placeholderData: (previousData) => previousData,
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });

    // --- Automatic Category Setup ---
    const hasTriggeredDefaultCategories = useRef(false);

    const categoriesQuery = useQuery<Category[]>({
        queryKey: financeKeys.categories(user?.id),
        queryFn: () => fetchCategoriesData(user!.id),
        enabled: !!user,
        staleTime: 1000 * 60 * 15, // Cache categories longer
        gcTime: 1000 * 60 * 60,
    });

    // --- Query for Recurring Transactions ---
    const recurringTransactionsQuery = useQuery<RecurringTransaction[], Error>({
        queryKey: ['recurringTransactions', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from('recurring_transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('next_due_date', { ascending: true }); // Order for easier viewing

            if (error) {
                console.error('Error fetching recurring transactions:', error);
                throw new Error(error.message);
            }
            return data || [];
        },
        enabled: !!user, // Only run if user is logged in
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });

    // --- Mutations ---

    // Generic error handler for mutations
    const onMutationError = (error: unknown, defaultMessage: string, context: unknown, queryKey: QueryKey) => {

        // Rollback on error using the context
        if (context && (context as { previousData?: unknown }).previousData) {
            queryClient.setQueryData(queryKey, (context as { previousData: unknown }).previousData);
        }
        const message = (error instanceof Error) ? error.message : defaultMessage;
        toast({
            title: "Error",
            description: message,
            variant: "destructive",
        });
    };

    // Add Income Mutation
    const addIncomeMutation = useMutation<Income, PostgrestError, Omit<Income, 'id' | 'user_id' | 'created_at'>>({
        mutationFn: async (newIncomeData) => {
            if (!user) throw new Error("User not authenticated");
            const { data, error } = await supabase
                .from('income')
                .insert([{ ...newIncomeData, user_id: user.id }])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            console.log("!!! addIncomeMutation onSuccess FIRING in Context for data:", data);
            const incomeQueryKey: QueryKey = ['income', filters.dateRange.from?.toISOString(), filters.dateRange.to?.toISOString()];

            // --- Manual Cache Update ---
            queryClient.setQueryData<Income[]>(incomeQueryKey, (oldData) => {
                if (oldData) {
                    console.log("!!! addIncomeMutation: Manually updating cache...");
                    // Add new item to the beginning of the array
                    return [data, ...oldData];
                }
                // If no old data, return array with just the new item (or let invalidation handle initial fetch)
                // Returning undefined might be safer if you rely on invalidation for initial load
                return oldData; // Or potentially: return [data]; if cache should always exist after add
            });
            console.log("!!! addIncomeMutation: Cache update attempted.");

            // --- Keep Invalidation (Optional but Recommended) ---
            queryClient.invalidateQueries({ queryKey: incomeQueryKey });
            console.log("!!! addIncomeMutation: Invalidated ['income'] query (after manual update).");

            toast({ title: "Success", description: "Income added." });
        },
        onError: (error) => {
            console.error("!!! addIncomeMutation onError FIRING in Context:", error);
            onMutationError(error, "Failed to add income.", null, financeKeys.income(user?.id, filters));
        },
    });

    // Update Income Mutation
    const updateIncomeMutation = useMutation<Income, PostgrestError, { id: string; updates: Partial<Omit<Income, 'id' | 'user_id' | 'created_at'>> }>({
        mutationFn: async ({ id, updates }) => {
            if (!user) throw new Error("User not authenticated");
            const { data, error } = await supabase
                .from('income')
                .update(updates)
                .eq('id', id)
                .eq('user_id', user.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (data, variables) => {
            toast({ title: "Success", description: "Income updated." });
            const incomeQueryKey: QueryKey = ['income', filters.dateRange.from?.toISOString(), filters.dateRange.to?.toISOString()];
            queryClient.setQueryData<Income[]>(incomeQueryKey, (oldData) =>
                oldData ? oldData.map(item =>
                    item.id === data.id ? { ...item, ...data } : item
                ) : oldData
            );
            queryClient.invalidateQueries({ queryKey: incomeQueryKey });
        },
        onError: (error) => onMutationError(error, "Failed to update income.", null, financeKeys.income(user?.id, filters)),
    });

    // Delete Income Mutation
    const deleteIncomeMutation = useMutation<boolean, PostgrestError, string>({
        mutationFn: async (id) => {
            if (!user) throw new Error("User not authenticated");
            const { error } = await supabase
                .from('income')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);
            if (error) throw error;
            return true;
        },
        onSuccess: (data, id) => {
            toast({ title: "Success", description: "Income deleted." });
            const incomeQueryKey: QueryKey = ['income', filters.dateRange.from?.toISOString(), filters.dateRange.to?.toISOString()];
            queryClient.setQueryData<Income[]>(incomeQueryKey, (oldData) =>
                oldData ? oldData.filter(item => item.id !== id) : oldData
            );
            queryClient.invalidateQueries({ queryKey: incomeQueryKey });
        },
        onError: (error) => onMutationError(error, "Failed to delete income.", null, financeKeys.income(user?.id, filters)),
    });

    // Add Expense Mutation
    const addExpenseMutation = useMutation<Expense, PostgrestError, Omit<Expense, 'id' | 'user_id' | 'created_at'>>({
        mutationFn: async (newExpenseData) => {
            if (!user) throw new Error("User not authenticated");
            // Handle 'month' column logic if necessary here
            const { data, error } = await supabase
                .from('expenses')
                .insert([{ ...newExpenseData, user_id: user.id }])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            toast({ title: "Success", description: "Expense added." });
            const expenseQueryKey: QueryKey = ['expenses', filters.dateRange.from?.toISOString(), filters.dateRange.to?.toISOString()];
            queryClient.setQueryData<Expense[]>(expenseQueryKey, (oldData) =>
                oldData ? [data, ...oldData] : [data]
            );
            queryClient.invalidateQueries({ queryKey: expenseQueryKey });
        },
        onError: (error) => onMutationError(error, "Failed to add expense.", null, financeKeys.expenses(user?.id, filters)),
    });

    // Update Expense Mutation
    const updateExpenseMutation = useMutation<Expense, PostgrestError, { id: string; updates: Partial<Omit<Expense, 'id' | 'user_id' | 'created_at'>> }>({
        mutationFn: async ({ id, updates }) => {
            if (!user) throw new Error("User not authenticated");
            // Handle 'month' column logic if necessary here
            const { data, error } = await supabase
                .from('expenses')
                .update(updates)
                .eq('id', id)
                .eq('user_id', user.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            toast({ title: "Success", description: "Expense updated." });
            const expenseQueryKey: QueryKey = ['expenses', filters.dateRange.from?.toISOString(), filters.dateRange.to?.toISOString()];
            queryClient.setQueryData<Expense[]>(expenseQueryKey, (oldData) =>
                oldData ? oldData.map(item =>
                    item.id === data.id ? data : item
                ) : oldData
            );
            queryClient.invalidateQueries({ queryKey: expenseQueryKey });
        },
        onError: (error) => onMutationError(error, "Failed to update expense.", null, financeKeys.expenses(user?.id, filters)),
    });

    // Delete Expense Mutation
    const deleteExpenseMutation = useMutation({
        mutationFn: async (id: string): Promise<string> => {
            if (!user) throw new Error("User not authenticated");
            const { error } = await supabase
                .from('expenses')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);
            if (error) {
                console.error("Error deleting expense:", error);
                throw error;
            }
            return id;
        },
        onSuccess: (deletedId) => {
            const expenseQueryKey: QueryKey = ['expenses', filters.dateRange.from?.toISOString(), filters.dateRange.to?.toISOString()];
            queryClient.setQueryData<Expense[]>(expenseQueryKey, (oldData) =>
                oldData ? oldData.filter(item => item.id !== deletedId) : oldData
            );
            queryClient.invalidateQueries({ queryKey: expenseQueryKey });
        },
        onError: (error) => {
            console.error("Delete Expense Mutation Failed:", error);
        }
    });

    // Add Category Mutation with Optimistic Update
    const addCategoryMutation = useMutation<Category, PostgrestError, Pick<Category, 'name' | 'type'>>({
        mutationFn: async (newCategoryData) => {
            if (!user) throw new Error("User not authenticated");
            const trimmedName = newCategoryData.name.trim();
            if (!trimmedName) throw new Error("Category name cannot be empty.");

            const { data, error } = await supabase
                .from('categories')
                .insert([{ ...newCategoryData, name: trimmedName, user_id: user.id }])
                .select()
                .single();
            if (error) {
                if (error.code === '23505') { throw new Error(`Category "${trimmedName}" already exists for this type.`); }
                throw error;
            }
            return data;
        },
        // Optimistically update the cache
        onMutate: async (newCategory) => {
            const queryKey = financeKeys.categories(user?.id);
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey });

            // Snapshot the previous value
            const previousData = queryClient.getQueryData<Category[]>(queryKey);

            // Optimistically update to the new value
            queryClient.setQueryData<Category[]>(queryKey, (old) => {
                const optimisticCategory: Category = {
                    // Create a temporary ID - won't be saved, just for the UI
                    id: `temp - ${Date.now()} `,
                    user_id: user!.id,
                    created_at: new Date().toISOString(),
                    ...newCategory,
                };
                // Add new category and sort alphabetically
                return [...(old || []), optimisticCategory].sort((a, b) => a.name.localeCompare(b.name));
            });

            // Return a context object with the snapshotted value
            return { previousData };
        },
        // If the mutation fails, use the context returned from onMutate to roll back
        onError: (err, newCategory, context) => {
            onMutationError(err, "Failed to add category.", context, financeKeys.categories(user?.id));
        },
        // Always refetch after error or success:
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.categories(user?.id) });
        },
    });

    // Mutation to add default categories
    const addDefaultCategoriesMutation = useMutation<Category[], PostgrestError, void>({
        mutationFn: async () => {
            if (!user) throw new Error("User not authenticated");

            const defaultCategories = [
                // Expenses
                { name: 'Housing', type: 'expense' as const, user_id: user.id },
                { name: 'Food & Dining', type: 'expense' as const, user_id: user.id },
                { name: 'Bills & Utilities', type: 'expense' as const, user_id: user.id },
                { name: 'Auto & Transport', type: 'expense' as const, user_id: user.id },
                { name: 'Health & Fitness', type: 'expense' as const, user_id: user.id },
                { name: 'Personal Care', type: 'expense' as const, user_id: user.id },
                { name: 'Entertainment', type: 'expense' as const, user_id: user.id },
                { name: 'Shopping', type: 'expense' as const, user_id: user.id },
                // Income
                { name: 'Salary', type: 'income' as const, user_id: user.id },
                { name: 'Freelance', type: 'income' as const, user_id: user.id },
                { name: 'Gifts', type: 'income' as const, user_id: user.id },
                { name: 'Interest', type: 'income' as const, user_id: user.id },
                { name: 'Investment', type: 'income' as const, user_id: user.id },
            ];

            const { data, error } = await supabase
                .from('categories')
                .insert(defaultCategories)
                .select();

            if (error) throw error;
            return data as Category[];
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.categories(user?.id) });
            toast({ title: "Categories Created", description: "Default categories have been added successfully." });
        },
        onError: (error) => {
            toast({ title: "Setup Failed", description: error instanceof Error ? error.message : "Failed to add default categories", variant: "destructive" });
        }
    });

    useEffect(() => {
        if (
            user &&
            categoriesQuery.status === 'success' &&
            categoriesQuery.data.length === 0 &&
            !hasTriggeredDefaultCategories.current &&
            !addDefaultCategoriesMutation.isPending
        ) {
            console.log("FinanceContext: No categories found, triggering automatic setup...");
            hasTriggeredDefaultCategories.current = true;
            addDefaultCategoriesMutation.mutate();
        }
    }, [user, categoriesQuery.status, categoriesQuery.data, addDefaultCategoriesMutation]);

    // Delete Category Mutation with Optimistic Update
    const deleteCategoryMutation = useMutation<boolean, PostgrestError, string>({
        mutationFn: async (id) => {
            if (!user) throw new Error("User not authenticated");
            const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', user.id);
            if (error) throw error;
            return true;
        },
        onMutate: async (idToDelete) => {
            const queryKey = financeKeys.categories(user?.id);
            await queryClient.cancelQueries({ queryKey });
            const previousData = queryClient.getQueryData<Category[]>(queryKey);

            // Optimistically remove the category
            queryClient.setQueryData<Category[]>(queryKey, (old) =>
                old?.filter((cat) => cat.id !== idToDelete) ?? []
            );

            return { previousData };
        },
        onError: (err, idToDelete, context) => {
            onMutationError(err, "Failed to delete category.", context, financeKeys.categories(user?.id));
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.categories(user?.id) });
        },
    });

    // Add Update Category Mutation
    const updateCategoryMutation = useMutation<Category, PostgrestError, { id: string; updates: Partial<Pick<Category, 'name' | 'type'>> }>({
        mutationFn: async ({ id, updates }) => {
            if (!user) throw new Error("User not authenticated");
            const trimmedName = updates.name?.trim();
            if (updates.name !== undefined && !trimmedName) throw new Error("Category name cannot be empty.");

            const updatePayload = {
                ...updates,
                ...(trimmedName && { name: trimmedName }) // Use trimmed name if provided
            };

            const { data, error } = await supabase
                .from('categories')
                .update(updatePayload)
                .eq('id', id)
                .eq('user_id', user.id)
                .select()
                .single();
            if (error) {
                if (error.code === '23505') { throw new Error(`Category "${trimmedName}" already exists for this type.`); }
                throw error;
            }
            return data;
        },
        // Optimistic update (optional but good UX)
        onMutate: async ({ id, updates }) => {
            const queryKey = financeKeys.categories(user?.id);
            await queryClient.cancelQueries({ queryKey });
            const previousData = queryClient.getQueryData<Category[]>(queryKey);
            queryClient.setQueryData<Category[]>(queryKey, (old) =>
                old?.map(cat => cat.id === id ? { ...cat, ...updates } : cat)
                    ?.sort((a, b) => a.name.localeCompare(b.name)) ?? [] // Re-sort after update
            );
            return { previousData };
        },
        onError: (err, variables, context) => {
            onMutationError(err, "Failed to update category.", context, financeKeys.categories(user?.id));
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: financeKeys.categories(user?.id) });
            // Important: Also invalidate income/expenses if you want category name changes reflected there immediately
            queryClient.invalidateQueries({ queryKey: ['income'] });
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
        },
    });

    // --- Mutation to Update Recurring Transaction ---
    const updateRecurringTransactionMutation = useMutation<
        RecurringTransaction | null,
        Error,
        { id: string; updates: RecurringTransactionUpdates }
    >({
        mutationFn: async ({ id, updates }) => {
            if (!user) throw new Error('User not authenticated');

            // Ensure dates are in correct format if provided
            if (updates.start_date) updates.start_date = format(new Date(updates.start_date), 'yyyy-MM-dd');
            if (updates.next_due_date) updates.next_due_date = format(new Date(updates.next_due_date), 'yyyy-MM-dd');
            if (updates.end_date) updates.end_date = format(new Date(updates.end_date), 'yyyy-MM-dd');

            const { data, error } = await supabase
                .from('recurring_transactions')
                .update(updates)
                .eq('id', id)
                .eq('user_id', user.id) // Ensure user owns the record
                .select()
                .single(); // Return the updated record

            if (error) {
                console.error('Error updating recurring transaction:', error);
                throw new Error(error.message);
            }
            return data;
        },
        onMutate: async (variables) => {
            // Optimistic update logic
            await queryClient.cancelQueries({ queryKey: ['recurringTransactions', user?.id] });
            const previousData = queryClient.getQueryData<RecurringTransaction[]>(['recurringTransactions', user?.id]);
            if (previousData) {
                queryClient.setQueryData<RecurringTransaction[]>(
                    ['recurringTransactions', user?.id],
                    previousData.map((item) =>
                        item.id === variables.id ? { ...item, ...variables.updates } : item
                    )
                );
            }
            return { previousData }; // Return context for rollback
        },
        onError: (error, variables, context: any) => {
            // Rollback on error
            if (context?.previousData) {
                queryClient.setQueryData(['recurringTransactions', user?.id], context.previousData);
            }
            console.error("Mutation failed:", error);
            // Consider adding toast notification here
        },
        onSettled: () => {
            // Invalidate to refetch from server
            queryClient.invalidateQueries({ queryKey: ['recurringTransactions', user?.id] });
        },
    });

    // --- Mutation to Delete Recurring Transaction ---
    const deleteRecurringTransactionMutation = useMutation<
        any,
        Error,
        string
    >({
        mutationFn: async (id) => {
            if (!user) throw new Error('User not authenticated');

            const { error } = await supabase
                .from('recurring_transactions')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id); // Ensure user owns the record

            if (error) {
                console.error('Error deleting recurring transaction:', error);
                throw new Error(error.message);
            }
            return null; // Or return something minimal
        },
        onMutate: async (idToDelete) => {
            // Optimistic update logic
            await queryClient.cancelQueries({ queryKey: ['recurringTransactions', user?.id] });
            const previousData = queryClient.getQueryData<RecurringTransaction[]>(['recurringTransactions', user?.id]);
            if (previousData) {
                queryClient.setQueryData<RecurringTransaction[]>(
                    ['recurringTransactions', user?.id],
                    previousData.filter((item) => item.id !== idToDelete)
                );
            }
            return { previousData }; // Return context for rollback
        },
        onError: (error, variables, context: any) => {
            // Rollback on error
            if (context?.previousData) {
                queryClient.setQueryData(['recurringTransactions', user?.id], context.previousData);
            }
            console.error("Deletion failed:", error);
            // Consider adding toast notification here
        },
        onSettled: () => {
            // Invalidate to refetch from server
            queryClient.invalidateQueries({ queryKey: ['recurringTransactions', user?.id] });
        },
    });

    const value = useMemo(() => ({
        user,
        filters,
        setFilters,
        incomeQuery,
        expensesQuery,
        categoriesQuery,
        recurringTransactionsQuery,
        addIncomeMutation,
        updateIncomeMutation,
        deleteIncomeMutation,
        addExpenseMutation,
        updateExpenseMutation,
        deleteExpenseMutation,
        addCategoryMutation,
        addDefaultCategoriesMutation,
        deleteCategoryMutation,
        updateCategoryMutation,
        createRecurringTransactionMutation: updateRecurringTransactionMutation,
        updateRecurringTransactionMutation,
        deleteRecurringTransactionMutation,
    }), [
        user,
        filters,
        setFilters,
        incomeQuery,
        expensesQuery,
        categoriesQuery,
        recurringTransactionsQuery,
        addIncomeMutation,
        updateIncomeMutation,
        deleteIncomeMutation,
        addExpenseMutation,
        updateExpenseMutation,
        deleteExpenseMutation,
        addCategoryMutation,
        addDefaultCategoriesMutation,
        deleteCategoryMutation,
        updateCategoryMutation,
        updateRecurringTransactionMutation,
        deleteRecurringTransactionMutation,
    ]);

    return (
        <FinanceContext.Provider value={value}>
            {children}
        </FinanceContext.Provider>
    );
};

// --- Hook ---
export const useFinance = () => {
    const context = useContext(FinanceContext);
    if (context === undefined) {
        throw new Error('useFinance must be used within a FinanceProvider');
    }
    return context;
}; 