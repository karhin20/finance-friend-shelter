import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Wallet, 
  Receipt, 
  BarChart3, 
  Settings, 
  LogOut,
  Menu,
  X,
  PiggyBank
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useIsMobile } from '@/hooks/use-mobile';

type NavItem = {
  icon: React.ReactNode;
  label: string;
  path: string;
};

const navItems: NavItem[] = [
  { icon: <LayoutDashboard className="h-4 w-4" />, label: 'Dashboard', path: '/dashboard' },
  { icon: <Wallet className="h-4 w-4" />, label: 'Income', path: '/income' },
  { icon: <Receipt className="h-4 w-4" />, label: 'Expenses', path: '/expenses' },
  { icon: <PiggyBank className="h-4 w-4" />, label: 'Savings', path: '/savings' },
  { icon: <BarChart3 className="h-4 w-4" />, label: 'Reports', path: '/reports' },
  { icon: <Settings className="h-4 w-4" />, label: 'Settings', path: '/settings' },
];

export function Navbar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const [scrolled, setScrolled] = useState(false);

  // Add shadow to navbar on scroll
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [scrolled]);

  // Close mobile menu when location changes
  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  // If no user, don't render the navbar
  if (!user) return null;

  // Get initials for avatar
  const getInitials = () => {
    if (!user?.email) return '?';
    return user.email.charAt(0).toUpperCase();
  };

  return (
    <header 
      className={cn(
        'fixed top-0 left-0 right-0 z-40 bg-white border-b transition-all duration-200',
        scrolled ? 'shadow-sm' : ''
      )}
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <div className="flex items-center">
          <Link to="/dashboard" className="flex items-center gap-2 mr-8">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-semibold">F</span>
            </div>
            <span className="font-semibold text-lg">Finance</span>
          </Link>

          {/* Desktop Navigation */}
          {!isMobile && (
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'nav-link',
                    location.pathname === item.path && 'nav-link-active'
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* User avatar & dropdown */}
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials()}
            </AvatarFallback>
          </Avatar>

          {/* Mobile menu button */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          )}

          {/* Sign out button (desktop only) */}
          {!isMobile && (
            <Button variant="ghost" size="sm" onClick={signOut} className="ml-2">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobile && (
        <div 
          className={cn(
            "fixed inset-0 z-50 md:hidden",
            isOpen ? "block" : "hidden"
          )}
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Nav menu - completely solid, removed header with "Menu" text */}
          <div className="absolute right-0 top-0 h-full w-3/4 max-w-xs bg-white shadow-xl">
            {/* Close button at the top right */}
            <div className="flex justify-end p-4">
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Navigation items */}
            <nav className="p-4 pt-0">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "nav-link py-3 my-1",
                    location.pathname === item.path && 'nav-link-active'
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
              <button 
                onClick={signOut}
                className="nav-link py-3 my-1 text-left text-destructive"
              >
                <LogOut className="h-5 w-5 mr-3" />
                <span>Sign out</span>
              </button>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
