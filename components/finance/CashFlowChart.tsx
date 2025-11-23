"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, Tooltip, YAxis } from "recharts";

interface ChartData {
  day: string;
  income: number;
  expense: number;
}

export function CashFlowChart({ data }: { data: ChartData[] }) {
  return (
    <Card className="col-span-2 bg-zinc-950 border-zinc-800 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Flujo de Caja (7 Días)
        </CardTitle>
      </CardHeader>
      <CardContent className="pl-0">
        <div className="h-[300px] w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis 
                dataKey="day" 
                stroke="#52525b" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false}
                dy={10}
              />
              <YAxis
                stroke="#52525b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip 
                cursor={{ fill: '#27272a' }}
                contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', color: '#fff', borderRadius: '6px', fontSize: '12px' }}
              />
              {/* Usamos colores un poco más apagados y barras más finas */}
              <Bar dataKey="income" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={40} name="Ingresos" />
              <Bar dataKey="expense" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={40} name="Gastos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}