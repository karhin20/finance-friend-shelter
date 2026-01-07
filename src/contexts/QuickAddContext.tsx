
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface QuickAddContextType {
    isIncomeOpen: boolean;
    setIncomeOpen: (open: boolean) => void;
    isExpenseOpen: boolean;
    setExpenseOpen: (open: boolean) => void;
    openIncomeModal: () => void;
    openExpenseModal: () => void;
}

const QuickAddContext = createContext<QuickAddContextType | undefined>(undefined);

export function QuickAddProvider({ children }: { children: ReactNode }) {
    const [isIncomeOpen, setIncomeOpen] = useState(false);
    const [isExpenseOpen, setExpenseOpen] = useState(false);

    const openIncomeModal = () => setIncomeOpen(true);
    const openExpenseModal = () => setExpenseOpen(true);

    return (
        <QuickAddContext.Provider value={{
            isIncomeOpen,
            setIncomeOpen,
            isExpenseOpen,
            setExpenseOpen,
            openIncomeModal,
            openExpenseModal
        }}>
            {children}
        </QuickAddContext.Provider>
    );
}

export function useQuickAdd() {
    const context = useContext(QuickAddContext);
    if (context === undefined) {
        throw new Error('useQuickAdd must be used within a QuickAddProvider');
    }
    return context;
}
