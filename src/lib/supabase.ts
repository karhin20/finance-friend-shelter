import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL and Anon Key must be provided.");
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
  category?: string; // Keep this for Income transactions
};

export type Expense = {
  id: string;
  user_id: string;
  amount: number;
  category: string; // References the name of a Category
  date: string;
  description?: string;
  month?: string; // Keep if used
};

// Add the Category type definition
export type Category = {
    id: string; // uuid
    user_id: string; // uuid, FK to auth.users
    name: string; // text
    type: 'income' | 'expense'; // text, constrained
    created_at: string; // timestamp with time zone
};

// Type for combined transactions on dashboard
export type Transaction = (Income | Expense) & {
  type: 'income' | 'expense';
  category: string; // Ensure category is available for both types
};

// Helper functions for formatting
export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
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
