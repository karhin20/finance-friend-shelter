import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Wallet, Receipt, Calculator, BarChart3, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
    const location = useLocation();

    const navItems = [
        { icon: LayoutDashboard, label: 'Home', path: '/dashboard' },
        { icon: Wallet, label: 'Income', path: '/income' },
        { icon: Receipt, label: 'Expenses', path: '/expenses' },
        { icon: PiggyBank, label: 'Savings', path: '/savings' },
        { icon: Calculator, label: 'Budget', path: '/budget' },
        { icon: BarChart3, label: 'Reports', path: '/reports' },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border/40 bg-background/80 backdrop-blur-lg z-50 md:hidden pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center overflow-x-auto no-scrollbar h-16 px-2 gap-1">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex min-w-[4.5rem] flex-1 flex-col items-center justify-center h-full gap-1 transition-all duration-200 active:scale-95 rounded-xl shrink-0",
                                isActive
                                    ? "text-primary font-bold bg-primary/5"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                        >
                            <item.icon
                                className={cn(
                                    "h-5 w-5 transition-transform duration-200",
                                    isActive && "scale-110 stroke-[2.5px]"
                                )}
                            />
                            <span className="text-[10px] tracking-wide">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
