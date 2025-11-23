"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#06b6d4'];

export function ExpenseDistribution({ data }: { data: CategoryData[] }) {
  // Asignar colores dinámicamente si no vienen
  const chartData = data.map((item, index) => ({
    ...item,
    color: COLORS[index % COLORS.length]
  }));

  return (
    <Card className="bg-zinc-950 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-white">Distribución de Gastos</CardTitle>
        <p className="text-sm text-zinc-500">Top categorías del mes</p>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip 
                 contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
                 formatter={(value: number) => `$${value.toLocaleString()}`}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-2">
          {chartData.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-zinc-400">{item.name}</span>
              </div>
              <span className="font-medium text-white">${item.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}