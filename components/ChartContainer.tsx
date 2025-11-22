"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function ChartContainer({ logs, consumos, color }: any) {
  const [view, setView] = useState<"SEMANA" | "MES">("SEMANA");

  const processData = () => {
    const days = view === "SEMANA" ? 7 : 30;
    const data = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const label = view === "SEMANA" 
        ? d.toLocaleDateString('es-AR', { weekday: 'short' }) 
        : d.getDate().toString();

      const start = new Date(d.setHours(0,0,0,0));
      const end = new Date(d.setHours(23,59,59,999));

      const xpLogs = logs
        .filter((l: any) => new Date(l.fin) >= start && new Date(l.fin) <= end)
        .reduce((sum: number, l: any) => sum + l.xpGanada, 0);
        
      const xpConsumos = consumos
        .filter((c: any) => new Date(c.timestamp) >= start && new Date(c.timestamp) <= end)
        .reduce((sum: number, c: any) => sum + c.xpGanada, 0);

      data.push({ name: label, xp: xpLogs + xpConsumos });
    }
    return data;
  };

  const data = processData();
  const barColor = color.includes("emerald") ? "#10b981" : 
                   color.includes("blue") ? "#3b82f6" : 
                   color.includes("red") ? "#ef4444" : "#ec4899";

  return (
    <div className="bg-[#111] border border-[#222] p-4 rounded-2xl shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Rendimiento XP</h3>
        <div className="flex bg-[#050505] p-1 rounded-lg border border-[#222]">
          <button 
            onClick={() => setView("SEMANA")}
            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${view === "SEMANA" ? "bg-[#222] text-white border border-[#333]" : "text-neutral-600 hover:text-neutral-400"}`}
          >
            7D
          </button>
          <button 
            onClick={() => setView("MES")}
            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${view === "MES" ? "bg-[#222] text-white border border-[#333]" : "text-neutral-600 hover:text-neutral-400"}`}
          >
            30D
          </button>
        </div>
      </div>

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis 
              dataKey="name" 
              stroke="#444" 
              tick={{fontSize: 10, fill: '#666'}} 
              axisLine={false}
              tickLine={false}
              tickMargin={10}
            />
            <Tooltip 
              contentStyle={{backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px', fontSize: '12px', color: '#fff'}}
              itemStyle={{color: '#fff'}}
              cursor={{fill: '#222', opacity: 0.4}}
            />
            <Bar dataKey="xp" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={barColor} fillOpacity={entry.xp > 0 ? 1 : 0.1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
