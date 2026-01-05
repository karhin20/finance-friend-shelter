import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CurrencySelector } from '@/components/CurrencySelector';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function Navbar() {
  const { user } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  // Map path to title
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Overview';
    if (path.includes('/income')) return 'Income Management';
    if (path.includes('/expenses')) return 'Expense Tracking';
    if (path.includes('/savings')) return 'Savings Goals';
    if (path.includes('/reports')) return 'Financial Reports';
    if (path.includes('/budget')) return 'Budgeting';
    if (path.includes('/recurring')) return 'Recurring Transactions';
    if (path === '/settings') return 'Settings';
    return 'Diligence Finance';
  };

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      if (isScrolled !== scrolled) setScrolled(isScrolled);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrolled, scrolled]);

  if (!user) return null;

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 flex h-16 items-center border-b bg-background/95 backdrop-blur-sm transition-all duration-500',
        'left-0 md:left-[--sidebar-width] group-data-[state=collapsed]:md:left-[--sidebar-width-icon]',
        scrolled ? 'shadow-premium border-border/60' : 'border-border/30'
      )}
    >
      <div className="flex w-full items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="flex md:hidden h-9 w-9" />
          <div className="hidden md:flex items-center gap-3">
            <SidebarTrigger className="h-9 w-9 text-muted-foreground hover:text-foreground transition-all duration-200" />
            <div className="h-6 w-[1px] bg-border/60 mx-1" />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-foreground animate-in fade-in slide-in-from-left-4 duration-500 font-display">
            {getPageTitle()}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <CurrencySelector />
          <ThemeToggle />
          <div className="h-8 w-[1px] bg-border/40 mx-1 hidden sm:block" />
          <div className="flex items-center gap-3 pl-1">
            <div className="hidden sm:flex flex-col items-end mr-1">
            </div>
            <Avatar className="h-9 w-9 border-2 border-background shadow-md ring-2 ring-primary/10 transition-all duration-300 active:scale-95 hover:ring-primary/20">
              <AvatarFallback className="bg-primary/15 text-primary font-bold text-xs">
                {user.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
    </header>
  );
}
