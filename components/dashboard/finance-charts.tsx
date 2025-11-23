"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, LabelList } from "recharts";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

// --- KPI CARD ---
export function FinancialKpi({ title, amount, type }: { title: string, amount: number, type: 'balance'|'income'|'expense' }) {
  const color = type === 'balance' ? (amount >= 0 ? 'text-white' : 'text-red-500') : type === 'income' ? 'text-emerald-400' : 'text-red-400';
  const Icon = type === 'balance' ? DollarSign : type === 'income' ? TrendingUp : TrendingDown;
  const iconColor = type === 'balance' ? 'text-neutral-400' : type === 'income' ? 'text-emerald-500' : 'text-red-500';

  return (
    <Card className="border-neutral-800 bg-neutral-900/50">
      <CardContent className="p-6 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className="text-xs text-neutral-500 uppercase font-bold">{title}</span>
        </div>
        <span className={`text-2xl font-bold tracking-tight ${color}`}>${amount.toLocaleString()}</span>
      </CardContent>
    </Card>
  );
}

// --- GRÁFICO COMPARATIVO (BARRAS) ---
export function FinanceComparisonChart({ transactions }: { transactions: any[] }) {
  const [range, setRange] = useState<"7D" | "30D">("7D");

  const chartData = useMemo(() => {
    const daysToShow = range === "7D" ? 7 : 30;
    const data = [];
    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      const nextDay = new Date(d); nextDay.setDate(d.getDate() + 1);
      const dayTx = transactions.filter(t => { const tDate = new Date(t.timestamp); return tDate >= d && tDate < nextDay; });
      const income = dayTx.filter(t => t.type === "INGRESO").reduce((sum, t) => sum + t.amount, 0);
      const expense = dayTx.filter(t => t.type === "GASTO").reduce((sum, t) => sum + t.amount, 0);
      data.push({ date: d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }), ingreso: income, gasto: expense });
    }
    return data;
  }, [transactions, range]);

  return (
    <Card className="border-neutral-800 bg-neutral-900/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium text-white">Flujo de Caja</CardTitle>
          <CardDescription>Comparativa Ingresos vs Gastos</CardDescription>
        </div>
        <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
          <button onClick={() => setRange("7D")} className={cn("text-xs font-medium px-3 py-1 rounded-md transition-all", range === "7D" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300")}>7D</button>
          <button onClick={() => setRange("30D")} className={cn("text-xs font-medium px-3 py-1 rounded-md transition-all", range === "30D" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300")}>30D</button>
        </div>
      </CardHeader>
      <CardContent className="h-[300px] pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 35, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis dataKey="date" stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#525252" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
            <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: "#171717", border: "1px solid #262626", borderRadius: "8px" }} itemStyle={{ fontSize: "12px" }} />
            <Bar dataKey="ingreso" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="gasto" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// --- NUEVO: PIE CHART LABEL (Estilo Shadcn Chart) ---
const CHART_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"
];

// Definimos una configuración genérica para mapear colores
const chartConfig = {
  amount: { label: "Monto" },
  category: { label: "Categoría" },
} satisfies ChartConfig;

export function ExpensePieChart({ transactions }: { transactions: any[] }) {
  const data = useMemo(() => {
    const gastos = transactions.filter(t => t.type === "GASTO");
    const grouped = gastos.reduce((acc: any, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {});
    
    return Object.keys(grouped)
      .map((key, index) => ({ 
        category: key, 
        amount: grouped[key], 
        fill: `hsl(var(--chart-${(index % 5) + 1}))` // Usamos variables CSS de Shadcn
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [transactions]);

  const totalGastos = data.reduce((acc, curr) => acc + curr.amount, 0);

  if (data.length === 0) return (
    <Card className="border-neutral-800 bg-neutral-900/50 h-full flex items-center justify-center text-neutral-500 text-xs min-h-[300px]">Sin gastos registrados</Card>
  );

  return (
    <Card className="flex flex-col border-neutral-800 bg-neutral-900/50 h-full">
      <CardHeader className="items-center pb-0">
        <CardTitle>Distribución de Gastos</CardTitle>
        <CardDescription>Top categorías del mes</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px] pb-0"
        >
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie data={data} dataKey="amount" label nameKey="category" />
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 leading-none font-medium">
          Total analizado: ${totalGastos.toLocaleString()} <TrendingDown className="h-4 w-4 text-red-500" />
        </div>
        <div className="leading-none text-muted-foreground">
          Mostrando las 5 categorías principales
        </div>
      </CardFooter>
    </Card>
  );
}

// (IncomeTrendChart eliminado)
export function IncomeTrendChart({ data }: { data: any[] }) { return null; }