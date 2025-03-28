import { supabase } from './supabase';

// SQL statements to create tables
const createIncomeTableSQL = `
CREATE TABLE IF NOT EXISTS public.income (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
`;

const createExpensesTableSQL = `
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
`;

const createSavingsTableSQL = `
CREATE TABLE IF NOT EXISTS public.savings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  goal_amount NUMERIC,
  title TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  target_date TIMESTAMP WITH TIME ZONE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
`;

// Function to setup the database schema
export const setupDatabase = async () => {
  try {
    // Create income table
    const { error: incomeError } = await supabase.rpc('run_sql', {
      sql: createIncomeTableSQL
    });
    
    if (incomeError) {
      console.error('Error creating income table:', incomeError);
      return false;
    }
    
    // Create expenses table
    const { error: expensesError } = await supabase.rpc('run_sql', {
      sql: createExpensesTableSQL
    });
    
    if (expensesError) {
      console.error('Error creating expenses table:', expensesError);
      return false;
    }
    
    // Create savings table
    const { error: savingsError } = await supabase.rpc('run_sql', {
      sql: createSavingsTableSQL
    });
    
    if (savingsError) {
      console.error('Error creating savings table:', savingsError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error setting up database:', error);
    return false;
  }
};

// This function would require the Supabase database to have the uuid-ossp extension enabled
// and the user to have permission to run raw SQL through RPC functions 