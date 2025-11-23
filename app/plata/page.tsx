import { PrismaClient } from "@prisma/client";
import { XPBar } from "@/components/finance/XPBar";
import { KPIGrid } from "@/components/finance/KPIGrid";
import { CashFlowChart } from "@/components/finance/CashFlowChart";
import { ExpenseDistribution } from "@/components/finance/ExpenseDistribution";
import { TransactionList } from "@/components/finance/TransactionList";

// Esto debería venir de tu singleton de prisma, pero lo dejo así por ahora
const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export default async function FinancePage() {
  // ... (MANTENER LA MISMA LOGICA DE DATOS QUE TE PASE ANTES) ...
  // Solo copio la parte visual del return para no hacer el mensaje eterno.
  // Asegúrate de no borrar la lógica de fetching de datos.
  
  // ----------------------------------------------------------
  // [PEGAR AQUI LA LOGICA DE DATOS ANTERIOR: userStats, transactions, etc]
  // Si la necesitas de nuevo avísame y la pego completa
  // ----------------------------------------------------------

  // ... (Lógica de datos) ...
  const userStats = await prisma.userStats.findFirst({ include: { user: true } });
  const transactions = await prisma.financialTransaction.findMany({ orderBy: { timestamp: 'desc' }, take: 50 });
  const totalIncome = transactions.filter(t => t.type === 'INGRESO').reduce((acc, c) => acc + c.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'GASTO').reduce((acc, c) => acc + c.amount, 0);
  const balance = totalIncome - totalExpenses;
  
  const today = new Date();
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(today.getDate() - (6 - i)); return d;
  });
  const barChartData = last7Days.map(date => {
    const txs = transactions.filter(t => new Date(t.timestamp).toDateString() === date.toDateString());
    return {
      day: date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }),
      income: txs.filter(t => t.type === 'INGRESO').reduce((acc, t) => acc + t.amount, 0),
      expense: txs.filter(t => t.type === 'GASTO').reduce((acc, t) => acc + t.amount, 0),
    };
  });

  const expenseCategories: Record<string, number> = {};
  transactions.filter(t => t.type === 'GASTO').forEach(t => { expenseCategories[t.category] = (expenseCategories[t.category] || 0) + t.amount; });
  const pieChartData = Object.entries(expenseCategories).map(([name, value]) => ({ name, value, color: '#000' })).sort((a, b) => b.value - a.value).slice(0, 5);
  const recentIncome = transactions.filter(t => t.type === 'INGRESO').slice(0, 5);
  const recentExpenses = transactions.filter(t => t.type === 'GASTO').slice(0, 5);

  return (
    <div className="p-6 space-y-6 min-h-screen bg-black text-white">
      {/* TITULO GRANDE TIPO GENERAL */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Plata</h1>
        <p className="text-zinc-500 text-sm">Gestión financiera y nivel de riqueza.</p>
      </header>

      {/* 1. Barra de XP (Ahora más compacta) */}
      <XPBar 
        level={userStats?.lvlPlata || 1} 
        currentXP={userStats?.xpPlata || 0} 
        nextLevelXP={100 * (userStats?.lvlPlata || 1)} 
      />

      {/* 2. KPIs (Ya estaban bien) */}
      <KPIGrid 
        balance={balance} 
        income={totalIncome} 
        expenses={totalExpenses} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3. Gráficos (Ahora con headers blancos e íconos) */}
        <CashFlowChart data={barChartData} />
        <ExpenseDistribution data={pieChartData} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 5. Listas */}
        <TransactionList title="Últimos Ingresos" type="income" transactions={recentIncome} />
        <TransactionList title="Últimos Gastos" type="expense" transactions={recentExpenses} />
      </div>
    </div>
  );
}