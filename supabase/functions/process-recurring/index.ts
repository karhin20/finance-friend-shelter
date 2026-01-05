import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { add } from 'https://esm.sh/date-fns@2.30.0' // Use date-fns for reliable date math

// Define a secret known only to the cron job and this function
// You should ideally set this as another environment secret,
// but for simplicity, we define it here. Replace with a strong random string.
const CRON_SECRET = Deno.env.get('CRON_SECRET') 

interface RecurringTransaction {
  id: string
  user_id: string
  type: 'income' | 'expense'
  amount: number
  category: string | null
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  start_date: string // ISO 8601 date string
  next_due_date: string // ISO 8601 date string
  end_date?: string | null // Optional ISO 8601 date string
  description?: string | null
  is_active: boolean
}

// Helper function to calculate the next due date
function calculateNextDueDate(currentDueDate: Date, frequency: RecurringTransaction['frequency']): Date {
  switch (frequency) {
    case 'daily':
      return add(currentDueDate, { days: 1 })
    case 'weekly':
      return add(currentDueDate, { weeks: 1 })
    case 'monthly':
      return add(currentDueDate, { months: 1 })
    case 'yearly':
      return add(currentDueDate, { years: 1 })
    default:
      // Should not happen due to table constraint, but fallback
      console.warn(`Unknown frequency: ${frequency}`)
      return add(currentDueDate, { months: 1 }) // Default to monthly on error?
  }
}

async function processTransactions(supabaseClient: SupabaseClient) {
  const today = new Date().toISOString().split('T')[0] // Get today's date in YYYY-MM-DD format
  console.log(`Processing recurring transactions due on or before: ${today}`)

  // Fetch active recurring transactions that are due
  const { data: transactions, error } = await supabaseClient
    .from('recurring_transactions')
    .select('*') // Selects all columns, including the new 'category' text column
    .eq('is_active', true)
    .lte('next_due_date', today)

  if (error) {
    console.error('Error fetching recurring transactions:', error)
    throw error
  }

  if (!transactions || transactions.length === 0) {
    console.log('No recurring transactions due today.')
    return { count: 0 }
  }

  console.log(`Found ${transactions.length} transactions to process.`)
  let processedCount = 0

  for (const tx of transactions as RecurringTransaction[]) {
    console.log(`Processing transaction ID: ${tx.id}`)
    // Insert into income or expenses table
    const targetTable = tx.type === 'income' ? 'income' : 'expenses'
    const { error: insertError } = await supabaseClient.from(targetTable).insert({
      user_id: tx.user_id,
      amount: tx.amount,
      category: tx.category,
      transaction_date: tx.next_due_date, // Use the due date as the transaction date
      description: tx.description ? `Recurring: ${tx.description}` : 'Recurring Transaction',
    })

    if (insertError) {
      console.error(`Error inserting ${tx.type} for recurring transaction ${tx.id} into ${targetTable}:`, insertError)
      continue // Continue to next transaction
    }

    console.log(`Successfully inserted ${tx.type} for transaction ID: ${tx.id}`)

    // Calculate next due date
    const currentDueDate = new Date(tx.next_due_date + 'T00:00:00Z') // Ensure correct date parsing (UTC)
    const newNextDueDate = calculateNextDueDate(currentDueDate, tx.frequency)
    const newNextDueDateStr = newNextDueDate.toISOString().split('T')[0]

    // Check end date and update recurring transaction
    let updatePayload: Partial<RecurringTransaction> = {
      next_due_date: newNextDueDateStr,
    }

    // Deactivate if end_date is reached or passed
    if (tx.end_date && newNextDueDate > new Date(tx.end_date + 'T23:59:59Z')) {
      updatePayload = { is_active: false } // Only update is_active, keep last successful due date
      console.log(`Recurring transaction ${tx.id} reached end date. Deactivating.`)
    } else {
       updatePayload = { next_due_date: newNextDueDateStr }
    }

    const { error: updateError } = await supabaseClient
      .from('recurring_transactions')
      .update(updatePayload)
      .eq('id', tx.id)

    if (updateError) {
      console.error(`Error updating next_due_date for recurring ID ${tx.id}:`, updateError)
      // Log error but don't increment errorCount as transaction was inserted
      // Needs manual review if this happens
    } else {
      console.log(`Updated recurring ID ${tx.id} next_due_date to ${updatePayload.next_due_date || 'N/A'}, active: ${updatePayload.is_active === false ? 'false' : 'true'}`)
    }

    processedCount++
  }
  return { count: processedCount }
}


serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // --- Security Check ---
  // Check for the secret in the request URL path
  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/');
  const triggerSecret = pathSegments[pathSegments.length - 1]; // Get the last part of the path

  if (triggerSecret !== CRON_SECRET) {
      console.warn('Unauthorized cron trigger attempt.');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
  }
  // --- End Security Check ---

  try {
    // Create a Supabase client with the Auth context of the function invoker
    // IMPORTANT: This requires the service_role key to update multiple users' data
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.")
    }

    // Create client with service role
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
       auth: {
         // Required to prevent issues with RLS using service key
         persistSession: false,
         autoRefreshToken: false
       }
    });

    console.log("Processing recurring transactions...")
    const result = await processTransactions(supabaseClient)
    console.log(`Processing complete. Processed: ${result.count}`)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error("Error in Edge Function:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})