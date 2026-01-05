import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SupabaseProvider } from "@/contexts/SupabaseContext";
import { FinanceProvider } from "@/contexts/FinanceContext";
import { ThemeProvider } from "@/components/theme-provider";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Income from "./pages/Income";
import Expenses from "./pages/Expenses";
import Savings from "./pages/Savings";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import DbSetup from "./pages/DbSetup";
import Budget from "./pages/Budget";
import NotFound from "./pages/NotFound";
import RecurringTransactionsPage from "./pages/RecurringTransactions";
import Joyride, { Step } from 'react-joyride';
import React, { useState, useEffect } from 'react';

const queryClient = new QueryClient();

const App = () => {
  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    if (!hasSeenTour) {
      setRunTour(true);
      localStorage.setItem('hasSeenTour', 'true');
    }
  }, []);

  const tourSteps: Step[] = [
    {
      target: '.dashboard-summary',
      content: 'Welcome to your financial dashboard! This is where you can see an overview of your income, expenses, and balance.',
      placement: 'bottom',
    },
    {
      target: '.add-income-button',
      content: 'Click here to add a new income transaction.',
      placement: 'bottom',
    },
    {
      target: '.add-expense-button',
      content: 'Use this button to record a new expense.',
      placement: 'bottom',
    },
    {
      target: '.income-history',
      content: 'Here you can view and manage your income history.',
      placement: 'top',
    },
    {
      target: '.expense-history',
      content: 'This is where you can see and edit your expense transactions.',
      placement: 'top',
    },
  ];

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;

    if ([ 'finished', 'skipped' ].includes(status)) {
      setRunTour(false);
    }
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SupabaseProvider>
            <FinanceProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/income" element={<Income />} />
                    <Route path="/expenses" element={<Expenses />} />
                    <Route path="/savings" element={<Savings />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/budget" element={<Budget />} />
                    <Route path="/recurring" element={<RecurringTransactionsPage />} />
                    <Route path="/db-setup" element={<DbSetup />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </FinanceProvider>
          </SupabaseProvider>
        </AuthProvider>
        <Joyride
          steps={tourSteps}
          run={runTour}
          continuous={true}
          showSkipButton={true}
          callback={handleJoyrideCallback}
          styles={{
            options: {
              arrowColor: '#fff',
              backgroundColor: '#fff',
              primaryColor: '#0A84FF',
              textColor: '#333',
              width: 300,
              zIndex: 1000,
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;