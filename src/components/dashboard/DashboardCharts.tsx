import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, PieChart, Pie, Bar, XAxis, YAxis, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';

interface DashboardChartsProps {
    chartData: any[];
    pieChartData: any[];
    isLoading: boolean;
    totalExpenses: number;
    COLORS: string[];
}

export const DashboardCharts = ({
    chartData,
    pieChartData,
    isLoading,
    totalExpenses,
    COLORS
}: DashboardChartsProps) => {
    const navigate = useNavigate();

    return (
        <div className="lg:col-span-12 xl:col-span-7 space-y-8">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-xl font-black tracking-tight font-display">Financial Trends</h3>
                <Button variant="ghost" size="sm" className="font-bold text-primary hover:bg-primary/5 rounded-xl" onClick={() => navigate('/reports')}>
                    Detailed Reports <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-[2.5rem] border-none shadow-premium bg-card overflow-hidden group">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Cash Flow</CardTitle>
                            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:rotate-12 transition-transform">
                                <BarChart3 className="h-4 w-4" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[280px] pt-4">
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center animate-pulse bg-muted/20 rounded-3xl" />
                        ) : chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                    <Tooltip cursor={false} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                    <Bar name="Income" dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={16} />
                                    <Bar name="Expenses" dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={16} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                                <p className="text-sm font-bold">Waiting for data...</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-border/30 shadow-premium overflow-hidden group hover:-translate-y-1 transition-all duration-500">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Spending</CardTitle>
                            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:rotate-12 transition-transform">
                                <PieChartIcon className="h-4 w-4" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[280px] pt-4">
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center animate-pulse bg-muted/20 rounded-3xl" />
                        ) : pieChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                                        {pieChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={2} stroke="hsl(var(--card))" />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                                <p className="text-sm font-bold">No expenses yet</p>
                            </div>
                        )}
                    </CardContent>
                    {/* Custom Legend */}
                    {pieChartData.length > 0 && (
                        <div className="px-6 pb-6 pt-2">
                            <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto pr-1 no-scrollbar">
                                {pieChartData.map((entry, index) => (
                                    <div key={index} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                        <span className="truncate">{entry.name}</span>
                                        <span className="ml-auto font-bold text-foreground">{((entry.value / totalExpenses) * 100).toFixed(0)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};
