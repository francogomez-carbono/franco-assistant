import { PrismaClient } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { FinanceComparisonChart, ExpensePieChart, FinancialKpi } from "@/components/dashboard/finance-charts";

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';
const MY_TELEGRAM_ID = "5002389519"; 

export default async function PlataPage() {
  const user = await prisma.user.findUnique({
    where: { telegramId: MY_TELEGRAM_ID },
    include: {
      stats: true,
      financials: { orderBy: { timestamp: 'desc' }, take: 100 }
    }
  });

  if (!user || !user.stats) return <div className="p-8 text-white">Cargando...</div>;

  // --- DATOS ---
  const currentXP = user.stats.xpPlata || 0;
  const currentLvl = user.stats.lvlPlata || 1;
  const targetXP = currentLvl * 100;
  const progress = Math.min(100, (currentXP / targetXP) * 100);

  const allTx = user.financials;
  const ingresos = allTx.filter(t => t.type === "INGRESO").reduce((sum, t) => sum + t.amount, 0);
  const gastos = allTx.filter(t => t.type === "GASTO").reduce((sum, t) => sum + t.amount, 0);
  const balance = ingresos - gastos;

  // Filtramos listas separadas para mostrar en el UI
  const recentIncomes = allTx.filter(t => t.type === "INGRESO").slice(0, 5);
  const recentExpenses = allTx.filter(t => t.type === "GASTO").slice(0, 10);

  const TransactionItem = ({ tx, isIncome }: { tx: any, isIncome: boolean }) => (
    <div className="flex items-center justify-between p-3 rounded-lg border border-neutral-800 bg-neutral-900/30 hover:bg-neutral-900 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-full shrink-0 ${isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
            {isIncome ? <TrendingUp className="h-4 w-4"/> : <TrendingDown className="h-4 w-4"/>}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-neutral-200 truncate pr-2">{tx.description || tx.category}</span>
          <span className="text-xs text-neutral-500">{new Date(tx.timestamp).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} • {tx.category}</span>
        </div>
      </div>
      <span className={`font-mono text-sm font-bold whitespace-nowrap ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
        {isIncome ? '+' : '-'}${tx.amount.toLocaleString()}
      </span>
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-6 w-full animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-2">
        <Link href="/" className="p-2 rounded-full bg-neutral-900 text-neutral-400 hover:text-white transition-colors"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-3xl font-bold tracking-widest uppercase text-emerald-500">PLATA</h1>
      </div>

      {/* NIVEL */}
      <Card className="border-neutral-800 bg-neutral-900/50">
        <CardContent className="p-6 flex flex-row items-center gap-6">
          <div className="relative flex items-center justify-center h-16 w-16 rounded-full bg-neutral-950 border-4 border-neutral-800 shrink-0">
            <span className="text-2xl font-black text-emerald-500">{currentLvl}</span>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-xs uppercase tracking-wider text-neutral-400 font-medium">
              <span>Experiencia</span><span className="text-white">{currentXP} / {targetXP} XP</span>
            </div>
            <div className="h-2 w-full bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
              <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <FinancialKpi title="Balance Total" amount={balance} type="balance" />
        <FinancialKpi title="Ingresos" amount={ingresos} type="income" />
        <FinancialKpi title="Gastos" amount={gastos} type="expense" />
      </div>

      {/* COMPARATIVA */}
      <div className="w-full">
        <FinanceComparisonChart transactions={allTx} />
      </div>

      {/* SECCIÓN INFERIOR: TORTA vs LISTAS */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        
        {/* COLUMNA IZQ: TORTA */}
        <div className="lg:col-span-1 h-full">
          <ExpensePieChart transactions={allTx} />
        </div>

        {/* COLUMNA DER: MOVIMIENTOS SEPARADOS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* INGRESOS (Arriba) */}
          <Card className="border-neutral-800 bg-neutral-900/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="h-4 w-4"/> Últimos Ingresos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentIncomes.map(tx => <TransactionItem key={tx.id} tx={tx} isIncome={true} />)}
              {recentIncomes.length === 0 && <p className="text-neutral-600 text-xs italic text-center py-2">No hay ingresos recientes.</p>}
            </CardContent>
          </Card>

          {/* GASTOS (Abajo) */}
          <Card className="border-neutral-800 bg-neutral-900/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-red-500 uppercase tracking-wider flex items-center gap-2">
                <TrendingDown className="h-4 w-4"/> Últimos Gastos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {recentExpenses.map(tx => <TransactionItem key={tx.id} tx={tx} isIncome={false} />)}
              {recentExpenses.length === 0 && <p className="text-neutral-600 text-xs italic text-center py-2">No hay gastos recientes.</p>}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}