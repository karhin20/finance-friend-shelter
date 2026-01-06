import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CurrencySelector } from '@/components/CurrencySelector';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Settings, LogOut, Palette, Coins } from 'lucide-react';

export function Navbar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Map path to title
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Overview';
    if (path.includes('/income')) return 'Income Tracking';
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
          {/* Mobile: Hidden Sidebar Trigger (Bottom Nav handles navigation) */}
          {/* Desktop: Show Sidebar Trigger */}
          <div className="hidden md:flex items-center gap-3">
            <SidebarTrigger className="h-9 w-9 text-muted-foreground hover:text-foreground transition-all duration-200" />
            <div className="h-6 w-[1px] bg-border/60 mx-1" />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-foreground animate-in fade-in slide-in-from-left-4 duration-500 font-display">
            {getPageTitle()}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Desktop Controls (Hidden on Mobile) */}
          <div className="hidden md:flex items-center gap-3">
            <CurrencySelector />
            <ThemeToggle />
            <div className="h-8 w-[1px] bg-border/40 mx-1" />
          </div>

          <div className="flex items-center gap-3 pl-1">
            {/* Mobile Profile Drawer Trigger */}
            <div className="md:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Avatar className="h-9 w-9 border-2 border-background shadow-md ring-2 ring-primary/10 transition-all cursor-pointer active:scale-95">
                    <AvatarFallback className="bg-primary/15 text-primary font-bold text-xs">
                      {user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[350px] p-0 border-l-border/50">
                  <SheetHeader className="p-6 border-b border-border/50 bg-muted/30">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14 border-4 border-background shadow-xl">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xl font-black">
                          {user.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1 text-left">
                        <SheetTitle className="text-base font-bold">{user.email?.split('@')[0]}</SheetTitle>
                        <p className="text-xs text-muted-foreground font-medium">{user.email}</p>
                      </div>
                    </div>
                  </SheetHeader>

                  <div className="p-4 space-y-6">
                    {/* Preferences Section */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground/70 px-2">Preferences</h4>
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-background text-foreground shadow-sm">
                              <Palette className="h-4 w-4" />
                            </div>
                            <span className="font-medium text-sm">Theme</span>
                          </div>
                          <ThemeToggle />
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-background text-foreground shadow-sm">
                              <Coins className="h-4 w-4" />
                            </div>
                            <span className="font-medium text-sm">Currency</span>
                          </div>
                          <CurrencySelector />
                        </div>
                      </div>
                    </div>

                    <div className="h-[1px] bg-border/50" />

                    {/* Account Section */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground/70 px-2">Account</h4>
                      <div className="grid gap-2">
                        <button onClick={() => { window.location.href = '/settings'; setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left group">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-sm">
                            <Settings className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-sm">Settings</span>
                        </button>
                        <button onClick={() => signOut()} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left group">
                          <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 group-hover:bg-red-600 group-hover:text-white transition-colors shadow-sm">
                            <LogOut className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-sm text-red-600 dark:text-red-400">Log out</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Desktop Dropdown (Hidden on Mobile) */}
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="cursor-pointer">
                    <Avatar className="h-9 w-9 border-2 border-background shadow-md ring-2 ring-primary/10 transition-all duration-300 active:scale-95 hover:ring-primary/20">
                      <AvatarFallback className="bg-primary/15 text-primary font-bold text-xs">
                        {user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-xl border-border/50">
                  <DropdownMenuItem className="cursor-pointer font-medium p-2.5 rounded-lg focus:bg-primary/10 focus:text-primary">
                    <span className="truncate">{user.email}</span>
                  </DropdownMenuItem>
                  <div className="h-[1px] bg-border/50 my-1" />
                  <DropdownMenuItem onClick={() => window.location.href = '/settings'} className="cursor-pointer font-medium p-2.5 rounded-lg focus:bg-primary/10 focus:text-primary">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer font-medium p-2.5 rounded-lg text-red-500 focus:bg-red-500/10 focus:text-red-500">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
