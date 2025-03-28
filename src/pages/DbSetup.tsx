import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Copy, AlertCircle, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const createTablesSql = `
-- Create income table
CREATE TABLE IF NOT EXISTS public.income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, 
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create savings table
CREATE TABLE IF NOT EXISTS public.savings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  goal_amount NUMERIC,
  title TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  target_date TIMESTAMP WITH TIME ZONE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on tables
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings ENABLE ROW LEVEL SECURITY;

-- Create policies for income table
CREATE POLICY "Users can view their own income" ON public.income
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own income" ON public.income
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own income" ON public.income
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own income" ON public.income
FOR DELETE USING (auth.uid() = user_id);

-- Create policies for expenses table
CREATE POLICY "Users can view their own expenses" ON public.expenses
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own expenses" ON public.expenses
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses" ON public.expenses
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenses" ON public.expenses
FOR DELETE USING (auth.uid() = user_id);

-- Create policies for savings table
CREATE POLICY "Users can view their own savings" ON public.savings
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own savings" ON public.savings
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own savings" ON public.savings
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own savings" ON public.savings
FOR DELETE USING (auth.uid() = user_id);
`;

export default function DbSetup() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(createTablesSql);
      setCopied(true);
      toast({
        title: "SQL copied to clipboard",
        description: "Paste this in the Supabase SQL Editor and run it",
      });
      
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please select and copy the text manually",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Database Setup</h1>
      
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Database Tables Required</AlertTitle>
        <AlertDescription>
          For this application to work, you need to create the necessary tables in your Supabase database.
          Copy the SQL below and execute it in the Supabase SQL Editor.
        </AlertDescription>
      </Alert>
      
      <Card>
        <CardHeader>
          <CardTitle>SQL Setup Script</CardTitle>
          <CardDescription>
            This script will create all required tables and set up row-level security policies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={createTablesSql}
            readOnly
            className="font-mono text-sm h-[400px] overflow-auto"
          />
        </CardContent>
        <CardFooter>
          <Button onClick={copyToClipboard}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied!" : "Copy SQL to Clipboard"}
          </Button>
        </CardFooter>
      </Card>
      
      <div className="mt-8 text-center">
        <p className="text-muted-foreground mb-4">
          After executing the SQL, return to the app and refresh the page.
        </p>
        <Button variant="outline" onClick={() => window.location.href = "/dashboard"}>
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
} 