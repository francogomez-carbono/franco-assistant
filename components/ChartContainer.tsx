"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

export function ChartContainer({ logs, color }: any) {
  const [view, setView] = useState<"SEMANA" | "MES">("SEMANA");

  const processData = () => {
    const data = [];
    const now = new Date();
    const diasSemana = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];

    if (view === "SEMANA") {
      // LÓGICA SEMANA (LUN-DOM)
      const day = now.getDay(); 
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);

        const label = diasSemana[d.getDay()];
        const fullDate = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

        const start = new Date(d.setHours(0, 0, 0, 0));
        const end = new Date(d.setHours(23, 59, 59, 999));

        const xpTotal = logs
          .filter((l: any) => new Date(l.fecha) >= start && new Date(l.fecha) <= end)
          .reduce((sum: number, l: any) => sum + l.xpGanada, 0);

        data.push({ name: label, fullDate, xp: xpTotal });
      }

    } else {
      // LÓGICA MES (Últimos 30)
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        
        const label = d.getDate().toString();
        const fullDate = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

        const start = new Date(d.setHours(0, 0, 0, 0));
        const end = new Date(d.setHours(23, 59, 59, 999));

        const xpTotal = logs
          .filter((l: any) => new Date(l.fecha) >= start && new Date(l.fecha) <= end)
          .reduce((sum: number, l: any) => sum + l.xpGanada, 0);

        data.push({ name: label, fullDate, xp: xpTotal });
      }
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
            className={`px-3 py-1 text-[10px] font-bold rounded-md ${view === "SEMANA" ? "bg-[#222] text-white border border-[#333]" : "text-neutral-600 hover:text-neutral-400"}`}
          >
            7D
          </button>
          <button 
            onClick={() => setView("MES")}
            className={`px-3 py-1 text-[10px] font-bold rounded-md ${view === "MES" ? "bg-[#222] text-white border border-[#333]" : "text-neutral-600 hover:text-neutral-400"}`}
          >
            30D
          </button>
        </div>
      </div>

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis 
              dataKey="name" 
              stroke="#444" 
              tick={{fontSize: 10, fill: '#666'}} 
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              // TRUCO: Si es semana, intervalo 0 (mostrar todos). Si es mes, auto (mostrar salteado).
              interval={view === "SEMANA" ? 0 : 'preserveStartEnd'}
              minTickGap={view === "SEMANA" ? 0 : 15}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-black border border-[#333] p-2 rounded-lg shadow-xl">
                      <p className="text-xs text-neutral-400 mb-1">{payload[0].payload.fullDate}</p>
                      <p className="text-sm font-bold text-white">+{payload[0].value} XP</p>
                    </div>
                  );
                }
                return null;
              }}
              cursor={{fill: '#222', opacity: 0.4}}
            />
            <Bar 
                dataKey="xp" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={40}
                isAnimationActive={false} // Adiós animación de barras creciendo
            >
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
