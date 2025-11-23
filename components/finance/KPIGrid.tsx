import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface KPIGridProps {
  balance: number;
  income: number;
  expenses: number;
}

export function KPIGrid({ balance, income, expenses }: KPIGridProps) {
  const formatMoney = (amount: number) => 
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);

  // Estilos comunes para mantener consistencia visual
  const cardStyles = "bg-zinc-950 border-zinc-800 shadow-sm";
  const titleStyles = "text-xs font-medium text-zinc-500 uppercase tracking-wider";
  const iconStyles = "h-4 w-4 text-zinc-500";

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className={cardStyles}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={titleStyles}>Balance Total</CardTitle>
          <DollarSign className={iconStyles} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{formatMoney(balance)}</div>
          <p className="text-xs text-zinc-600 mt-1">Disponibilidad actual</p>
        </CardContent>
      </Card>

      <Card className={cardStyles}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={titleStyles}>Ingresos Mes</CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-500/70" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-500">{formatMoney(income)}</div>
          <p className="text-xs text-zinc-600 mt-1">Acumulado mensual</p>
        </CardContent>
      </Card>

      <Card className={cardStyles}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={titleStyles}>Gastos Mes</CardTitle>
          <TrendingDown className="h-4 w-4 text-rose-500/70" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-rose-500">{formatMoney(expenses)}</div>
          <p className="text-xs text-zinc-600 mt-1">Acumulado mensual</p>
        </CardContent>
      </Card>
    </div>
  );
}