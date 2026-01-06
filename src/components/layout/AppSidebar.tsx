import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import {
    LayoutDashboard,
    Wallet,
    Receipt,
    BarChart3,
    Settings,
    LogOut,
    PiggyBank,
    Calculator,
    Repeat,
    ChevronUp,
    User2
} from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
} from "@/components/ui/sidebar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: (props: any) => <Wallet {...props} strokeWidth={2.5} />, label: 'Income', path: '/income' },
    { icon: Receipt, label: 'Expenses', path: '/expenses' },
    { icon: PiggyBank, label: 'Savings', path: '/savings' },
    { icon: BarChart3, label: 'Reports', path: '/reports' },
    { icon: Calculator, label: 'Budget', path: '/budget' },
    { icon: Repeat, label: 'Recurring', path: '/recurring' },
    { icon: Settings, label: 'Settings', path: '/settings' },
]

export function AppSidebar() {
    const { user, signOut } = useAuth()
    const location = useLocation()

    return (
        <Sidebar collapsible="icon" className="border-r border-border/40 shadow-premium" style={{ backgroundColor: 'hsl(var(--sidebar-background))' }}>
            <SidebarHeader className="border-b border-sidebar-border/40 py-4 px-6 mb-2">
                <Link to="/dashboard" className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[1.25rem] bg-primary shadow-lg shadow-primary/25 transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl group-hover:shadow-primary/30">
                        <span className="text-xl font-black text-primary-foreground">D</span>
                    </div>
                    <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                        <span className="text-base font-bold tracking-tight text-foreground font-display">Diligence</span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">Finance</span>
                    </div>
                </Link>
            </SidebarHeader>

            <SidebarContent className="px-3">
                <SidebarGroup>
                    <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2 group-data-[collapsible=icon]:hidden">
                        Menu
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu className="gap-1">
                            {navItems.map((item) => (
                                <SidebarMenuItem key={item.path}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={location.pathname === item.path}
                                        tooltip={item.label}
                                        className={cn(
                                            "h-11 rounded-[1.25rem] transition-all duration-300 ease-out hover:bg-sidebar-accent",
                                            location.pathname === item.path && "bg-primary/10 text-primary font-bold shadow-sm shadow-primary/5 border border-primary/10"
                                        )}
                                    >
                                        <Link to={item.path} className="flex items-center gap-3">
                                            <item.icon className={cn(
                                                "h-5 w-5 transition-all duration-300",
                                                location.pathname === item.path ? "text-primary scale-110" : "text-muted-foreground group-hover:scale-105"
                                            )} />
                                            <span className="text-sm font-medium">{item.label}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border/40 p-3 mb-2">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton
                                    size="lg"
                                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground rounded-[1.25rem] transition-all duration-300 hover:bg-sidebar-accent/80"
                                >
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
                                        <User2 className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col items-start text-xs group-data-[collapsible=icon]:hidden overflow-hidden">
                                        <span className="font-semibold truncate w-full">{user?.email?.split('@')[0]}</span>
                                        <span className="text-[10px] text-muted-foreground truncate w-full">{user?.email}</span>
                                    </div>
                                    <ChevronUp className="ml-auto h-4 w-4 group-data-[collapsible=icon]:hidden opacity-50" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                side="top"
                                className="w-[calc(var(--sidebar-width)-1.5rem)] rounded-xl p-2 shadow-2xl border-border/50"
                                align="start"
                            >
                                <DropdownMenuItem className="rounded-lg cursor-pointer flex items-center gap-2" asChild>
                                    <Link to="/settings">
                                        <Settings className="h-4 w-4" />
                                        <span>Account Settings</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="rounded-lg cursor-pointer flex items-center gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                    onClick={signOut}
                                >
                                    <LogOut className="h-4 w-4" />
                                    <span>Sign out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}
