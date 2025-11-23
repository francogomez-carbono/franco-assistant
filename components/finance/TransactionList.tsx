import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";

interface Transaction {
  id: string;
  description: string | null;
  category: string;
  amount: number;
  timestamp: Date;
  type: "INGRESO" | "GASTO";
}

interface TransactionListProps {
  title: string;
  transactions: Transaction[];
  type: "income" | "expense";
}

export function TransactionList({ title, transactions, type }: TransactionListProps) {
  const isIncome = type === "income";
  // Colores condicionales sutiles
  const iconBg = isIncome ? "bg-emerald-500/10" : "bg-rose-500/10";
  const iconColor = isIncome ? "text-emerald-500" : "text-rose-500";
  const amountColor = isIncome ? "text-emerald-500" : "text-rose-500";

  return (
    <Card className="bg-zinc-950 border-zinc-800 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800">
          {transactions.length === 0 ? (
            <p className="text-xs text-zinc-600 italic py-4">No hay movimientos recientes.</p>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="group flex items-center justify-between p-3 rounded-md hover:bg-zinc-900/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${iconBg} ${iconColor}`}>
                    {isIncome ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-zinc-200 leading-none">
                      {tx.description || tx.category}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {new Date(tx.timestamp).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} • {tx.category}
                    </span>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${amountColor}`}>
                  {isIncome ? '+' : '-'}${tx.amount.toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}