"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, Tooltip, YAxis } from "recharts";
import { BarChart3 } from "lucide-react"; // Ícono para el título

interface ChartData {
  day: string;
  income: number;
  expense: number;
}

export function CashFlowChart({ data }: { data: ChartData[] }) {
  return (
    <Card className="col-span-2 bg-zinc-950 border-zinc-800 shadow-sm">
      {/* HEADER TIPO "GENERAL": Ícono + Título Blanco + Subtítulo */}
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className="p-2 bg-emerald-500/10 rounded-lg">
           <BarChart3 className="w-5 h-5 text-emerald-500" />
        </div>
        <div className="flex flex-col">
          <CardTitle className="text-base font-bold text-white">Flujo de Caja</CardTitle>
          <p className="text-xs text-zinc-500">Comparativa 7 días</p>
        </div>
      </CardHeader>
      
      <CardContent className="pl-0 mt-2">
        <div className="h-[300px] w-full">
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
              <Bar dataKey="income" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={40} name="Ingresos" />
              <Bar dataKey="expense" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={40} name="Gastos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}