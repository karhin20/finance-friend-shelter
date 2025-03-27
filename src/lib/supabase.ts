
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// Use environment variables or fallback to empty values
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-supabase-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// Show a warning if environment variables are missing
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Missing Supabase environment variables. Using placeholder values. The app will not function correctly until proper values are provided.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions for our database
export type User = {
  id: string;
  email: string;
};

export type Income = {
  id: string;
  user_id: string;
  amount: number;
  date: string;
  description?: string;
  // Adding a category field to make it compatible with our dashboard code
  category?: string;
};

export type Expense = {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
};

// Type for combined transactions on dashboard
export type Transaction = (Income | Expense) & {
  type: 'income' | 'expense';
  category: string; // Ensure category is available for both types
};

// Helper functions for formatting
export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};
