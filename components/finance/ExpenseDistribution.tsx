"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react"; // Ícono

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

const COLORS = ['#e11d48', '#f97316', '#eab308', '#84cc16', '#06b6d4'];

export function ExpenseDistribution({ data }: { data: CategoryData[] }) {
  const chartData = data.map((item, index) => ({
    ...item,
    color: COLORS[index % COLORS.length]
  }));

  return (
    <Card className="bg-zinc-950 border-zinc-800 shadow-sm">
      {/* HEADER TIPO "GENERAL" */}
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className="p-2 bg-rose-500/10 rounded-lg">
           <PieChartIcon className="w-5 h-5 text-rose-500" />
        </div>
        <div className="flex flex-col">
          <CardTitle className="text-base font-bold text-white">Gastos</CardTitle>
          <p className="text-xs text-zinc-500">Por categoría</p>
        </div>
      </CardHeader>

      <CardContent>
        <div className="h-[250px] w-full mt-2">
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
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                 contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', color: '#fff', borderRadius: '6px' }}
                 formatter={(value: number) => `$${value.toLocaleString()}`}
                 itemStyle={{ color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Leyenda más compacta */}
        <div className="mt-2 space-y-2">
          {chartData.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-zinc-400">{item.name}</span>
              </div>
              <span className="font-medium text-zinc-200">${item.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}