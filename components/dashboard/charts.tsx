"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
import { Zap, PieChart as PieIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EnergyChart({ data }: { data: any[] }) {
  const [range, setRange] = useState<"7D" | "30D">("7D");
  const filteredData = range === "7D" ? data.slice(-7) : data.slice(-30);
  const chartData = filteredData.length > 0 ? filteredData : [{ fecha: "Hoy", energia: 0, foco: 0 }];

  return (
    <Card className="col-span-1 lg:col-span-2 border-neutral-800 bg-neutral-900/50 text-neutral-100 h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-400" />
          Rendimiento {range === "7D" ? "Semanal" : "Mensual"}
        </CardTitle>
        <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
          <button onClick={() => setRange("7D")} className={cn("text-xs font-medium px-3 py-1 rounded-md transition-all", range === "7D" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300")}>7D</button>
          <button onClick={() => setRange("30D")} className={cn("text-xs font-medium px-3 py-1 rounded-md transition-all", range === "30D" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300")}>30D</button>
        </div>
      </CardHeader>
      {/* AUMENTO DE ALTURA A 350px */}
      <CardContent className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorEnergia" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis dataKey="fecha" stroke="#525252" fontSize={12} tickLine={false} axisLine={false} interval={range === "30D" ? 2 : 0} />
            <YAxis stroke="#525252" fontSize={12} tickLine={false} axisLine={false} domain={[0, 5]} tickCount={6} allowDecimals={false}/>
            <Tooltip contentStyle={{ backgroundColor: "#171717", border: "1px solid #262626", borderRadius: "8px" }} itemStyle={{ color: "#e5e5e5" }} />
            <Area type="monotone" dataKey="energia" stroke="#eab308" fillOpacity={1} fill="url(#colorEnergia)" strokeWidth={2} activeDot={{ r: 6 }}/>
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function XPDonutChart({ stats }: { stats: any }) {
  const data = [
    { name: 'Plata', value: stats.xpPlata, color: '#10b981' },
    { name: 'Pensar', value: stats.xpPensar, color: '#3b82f6' },
    { name: 'Físico', value: stats.xpFisico, color: '#f97316' },
    { name: 'Social', value: stats.xpSocial, color: '#f43f5e' },
  ].filter(item => item.value > 0);
  
  const finalData = data.length > 0 ? data : [{ name: 'Sin Datos', value: 1, color: '#333' }];

  return (
    <Card className="col-span-1 lg:col-span-1 border-neutral-800 bg-neutral-900/50 text-neutral-100 h-full">
      <CardHeader>
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <PieIcon className="h-4 w-4 text-purple-400" />
          Origen de XP
        </CardTitle>
      </CardHeader>
      {/* AUMENTO DE ALTURA A 350px */}
      <CardContent className="h-[350px] flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={finalData}
              cx="50%"
              cy="50%"
              innerRadius={80} 
              outerRadius={110}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {finalData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: "#171717", border: "1px solid #262626", borderRadius: "8px" }} itemStyle={{ color: "#fff" }} />
            <Legend verticalAlign="bottom" height={36} iconType="circle"/>
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function PillarBarChart({ data }: { data: any[] }) {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
          <XAxis dataKey="day" stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip cursor={{fill: '#262626'}} contentStyle={{ backgroundColor: "#171717", border: "1px solid #262626" }} itemStyle={{ color: "#fff" }} />
          <Bar dataKey="xp" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
}
