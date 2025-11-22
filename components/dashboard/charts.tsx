"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Zap } from "lucide-react";

export function EnergyChart({ data }: { data: any[] }) {
  const chartData = data.length > 0 ? data : [
    { fecha: "Mon", energia: 3, foco: 2 },
    { fecha: "Tue", energia: 4, foco: 4 },
  ];

  return (
    <Card className="col-span-4 border-neutral-800 bg-neutral-900/50 text-neutral-100">
      <CardHeader>
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-400" />
          Rendimiento Semanal
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorEnergia" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="fecha" stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#525252" fontSize={12} tickLine={false} axisLine={false} domain={[0, 5]} />
            <Tooltip contentStyle={{ backgroundColor: "#171717", border: "1px solid #262626" }} itemStyle={{ color: "#e5e5e5" }} />
            <Area type="monotone" dataKey="energia" stroke="#eab308" fillOpacity={1} fill="url(#colorEnergia)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ProductivityHeatmap({ logs }: { logs: any[] }) {
  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
  logs.forEach(log => {
    const date = new Date(log.inicio);
    const day = date.getDay(); 
    const hour = date.getHours(); 
    matrix[day][hour] += 1; 
  });

  const days = ["D", "L", "M", "M", "J", "V", "S"];
  const getColor = (count: number) => {
    if (count === 0) return "bg-neutral-800/50";
    if (count === 1) return "bg-orange-900/60";
    if (count >= 2) return "bg-orange-500";
    return "bg-neutral-800";
  };

  return (
    <Card className="col-span-3 border-neutral-800 bg-neutral-900/50 text-neutral-100">
      <CardHeader>
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-orange-500" />
          Matriz de Foco
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px] text-neutral-500 px-6 mb-1">
            <span>00h</span><span>12h</span><span>23h</span>
          </div>
          {matrix.map((row, dayIndex) => (
            <div key={dayIndex} className="flex items-center gap-1 h-6">
              <span className="w-4 text-[10px] text-neutral-500 text-right mr-1">{days[dayIndex]}</span>
              {row.map((count, hourIndex) => (
                <div key={hourIndex} className={`flex-1 h-full rounded-sm ${getColor(count)}`} title={`${count} Bloques`} />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
