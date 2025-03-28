import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

type SupabaseContextType = {
  supabase: typeof supabase;
  initializeDatabase: () => Promise<void>;
  fetchAndAggregateSpending: (timePeriod: string, startDate?: Date, endDate?: Date) => Promise<Record<string, number> | null>;
  isLoading: boolean;
  dbInitialized: boolean;
};

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export const SupabaseProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);
  const { toast } = useToast();

  // Initialize database tables if they don't exist
  const initializeDatabase = async () => {
    setIsLoading(true);
    try {
      // Get tables from Supabase schema
      const { data, error } = await supabase
        .from('_tables')
        .select('name')
        .limit(10);
      
      if (error) {
        console.error('Error checking tables:', error);
        // Most likely the tables don't exist or user doesn't have permission
        
        // Show toast with SQL to create tables
        toast({
          title: "Database tables need to be created",
          description: "Please execute the SQL statements to create tables in your Supabase SQL Editor",
          variant: "destructive",
        });
        
        return;
      }
      
      // Check which tables exist
      const tableNames = data?.map(t => t.name) || [];
      const missingTables = [];
      
      if (!tableNames.includes('income')) missingTables.push('income');
      if (!tableNames.includes('expenses')) missingTables.push('expenses');
      if (!tableNames.includes('savings')) missingTables.push('savings');
      
      if (missingTables.length > 0) {
        toast({
          title: "Missing database tables",
          description: `Tables needed: ${missingTables.join(', ')}. Please set up your database schema.`,
          variant: "destructive",
        });
        return;
      }
      
      setDbInitialized(true);
    } catch (error) {
      console.error('Error initializing database:', error);
      toast({
        title: "Database Error",
        description: "Could not initialize the database. Please check your Supabase setup.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Modified function to check if tables exist without causing errors
  const safeCheckTablesExist = async () => {
    try {
      const { data, error } = await supabase
        .rpc('check_tables_exist', { 
          table_names: ['income', 'expenses', 'savings'] 
        });
      
      if (error) {
        console.error('Error checking tables:', error);
        return false;
      }
      
      return data?.exists || false;
    } catch (error) {
      console.error('Error in safeCheckTablesExist:', error);
      return false;
    }
  };

  // Check tables on mount
  useEffect(() => {
    const checkDbStatus = async () => {
      try {
        // Try a simple query to check if connected
        const { error } = await supabase.from('savings').select('count').maybeSingle();
        
        // If no error, assume table exists
        if (!error) {
          setDbInitialized(true);
          return;
        }
        
        // If error is about table not existing, provide guidance
        if (error.message.includes('does not exist')) {
          toast({
            title: "Database tables need to be created",
            description: "Please create the necessary tables using the SQL in the documentation",
            variant: "destructive",
          });
        } else {
          console.error('Database error:', error);
        }
      } catch (error) {
        console.error('Error checking DB status:', error);
      }
    };
    
    // Only run if we have a user authenticated
    checkDbStatus();
  }, [toast]);

  const fetchAndAggregateSpending = async (
    timePeriod: string,
    customStartDate?: Date,
    customEndDate?: Date
  ) => {
    setIsLoading(true);
    
    try {
      // Calculate start and end dates based on time period
      let startDate: Date;
      let endDate: Date = new Date();
      
      if (customStartDate && customEndDate && timePeriod === 'custom') {
        startDate = customStartDate;
        endDate = customEndDate;
      } else {
        const now = new Date();
        
        switch (timePeriod) {
          case 'week':
            const lastWeek = new Date(now);
            lastWeek.setDate(now.getDate() - 7);
            startDate = lastWeek;
            break;
          case 'month':
            const lastMonth = new Date(now);
            lastMonth.setMonth(now.getMonth() - 1);
            startDate = lastMonth;
            break;
          case 'year':
            const lastYear = new Date(now);
            lastYear.setFullYear(now.getFullYear() - 1);
            startDate = lastYear;
            break;
          default:
            // Default to last 30 days
            const last30Days = new Date(now);
            last30Days.setDate(now.getDate() - 30);
            startDate = last30Days;
        }
      }

      try {
        // Fetch expenses
        const { data: expenses, error: expensesError } = await supabase
          .from('expenses')
          .select('*')
          .gte('date', startDate.toISOString())
          .lte('date', endDate.toISOString());
  
        if (expensesError) {
          console.error("Error fetching expenses:", expensesError);
          // If table doesn't exist, return empty data instead of throwing
          if (expensesError.message.includes('does not exist')) {
            return {};
          }
          throw expensesError;
        }
  
        // Aggregate spending by category
        const categorySpending: Record<string, number> = {};
        
        if (expenses && expenses.length > 0) {
          expenses.forEach(expense => {
            const category = expense.category;
            if (categorySpending[category]) {
              categorySpending[category] += expense.amount;
            } else {
              categorySpending[category] = expense.amount;
            }
          });
        }
  
        return categorySpending;
      } catch (error) {
        console.error("Error in expense fetching:", error);
        return {};
      }
    } catch (error) {
      console.error("Error in fetchAndAggregateSpending:", error);
      return {};
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SupabaseContext.Provider value={{ 
      supabase,
      initializeDatabase,
      fetchAndAggregateSpending,
      isLoading,
      dbInitialized
    }}>
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};