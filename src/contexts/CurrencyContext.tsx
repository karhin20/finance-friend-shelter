import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Currency = {
    code: string;
    symbol: string;
    name: string;
    country: string;
};

export const CURRENCIES: Currency[] = [
    { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi', country: 'Ghana' },
    { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', country: 'Nigeria' },
    { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', country: 'Kenya' },
    { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', country: 'Uganda' },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand', country: 'South Africa' },
    { code: 'GBP', symbol: '£', name: 'British Pound', country: 'United Kingdom' },
    { code: 'USD', symbol: '$', name: 'US Dollar', country: 'United States' },
    { code: 'ZMW', symbol: 'ZK', name: 'Zambian Kwacha', country: 'Zambia' },
];

interface CurrencyContextType {
    currency: Currency;
    setCurrency: (currency: Currency) => void;
    formatCurrency: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
    const [currency, setCurrencyState] = useState<Currency>(() => {
        // Try to load from localStorage
        const saved = localStorage.getItem('user-currency');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                return CURRENCIES[6]; // Default to USD
            }
        }
        return CURRENCIES[6]; // Default to USD
    });

    // Save to localStorage whenever currency changes
    useEffect(() => {
        localStorage.setItem('user-currency', JSON.stringify(currency));
    }, [currency]);

    const formatCurrency = (amount: number): string => {
        const formatted = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);

        return `${currency.symbol}${formatted}`;
    };

    const setCurrency = (newCurrency: Currency) => {
        setCurrencyState(newCurrency);
    };

    return (
        <CurrencyContext.Provider value={{ currency, setCurrency, formatCurrency }}>
            {children}
        </CurrencyContext.Provider>
    );
}

export function useCurrency() {
    const context = useContext(CurrencyContext);
    if (context === undefined) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
}
