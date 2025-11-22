"use client";

import { CheckCircle2, Circle, Trash2 } from "lucide-react";
import { deleteActivity, toggleQuest } from "@/app/actions";
import { useState } from "react";
import { cn } from "@/lib/utils";

// --- COMPONENTE 1: LISTA DE HISTORIAL CON DELETE ---
export function InteractiveHistory({ logs, pilar, userId }: { logs: any[], pilar: string, userId: string }) {
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const handleDelete = async (id: string, xp: number) => {
    const confirm = window.confirm("¿Borrar esta actividad y perder la XP?");
    if (!confirm) return;

    setDeletedIds((prev) => new Set(prev).add(id)); 
    await deleteActivity(id, xp, pilar, userId); 
  };

  if (logs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center border border-dashed border-neutral-800 rounded-xl min-h-[150px]">
        <p className="text-neutral-600 text-sm italic">Sin actividad registrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
      {logs.map((log) => {
        if (deletedIds.has(log.id)) return null; 

        return (
          <div key={log.id} className="group flex items-center justify-between p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 transition-colors">
            <div className="flex-1 min-w-0 mr-4">
              <p className="font-medium text-neutral-200 text-sm truncate">{log.tarea}</p>
              {/* FIX: Agregamos suppressHydrationWarning para evitar el error de zona horaria */}
              <p className="text-xs text-neutral-500" suppressHydrationWarning>
                {new Date(log.inicio).toLocaleDateString('es-AR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 rounded-md bg-neutral-950 border border-neutral-800 text-xs font-bold text-neutral-400 whitespace-nowrap">
                +{log.xpGanada} XP
              </div>
              <button 
                onClick={() => handleDelete(log.id, log.xpGanada)}
                className="p-2 text-neutral-600 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                title="Borrar actividad"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- COMPONENTE 2: MISIONES DIARIAS INTERACTIVAS ---
export function InteractiveQuests({ quests, completedMap, pilar, userId }: any) {
  
  const handleToggle = async (title: string, xp: number, currentStatus: boolean) => {
    await toggleQuest(title, xp, pilar, userId, currentStatus);
  };

  return (
    <div className="space-y-3">
      {quests.map((q: any, i: number) => {
        const isDone = completedMap[q.title] || false; 

        return (
          <div 
            key={i} 
            onClick={() => handleToggle(q.title, q.xp, isDone)}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all select-none",
              isDone 
                ? "bg-emerald-950/20 border-emerald-900/50" 
                : "bg-neutral-950 border-neutral-800 hover:border-neutral-700"
            )}
          >
            <div className="flex items-center gap-3">
              {isDone 
                ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> 
                : <Circle className="h-5 w-5 text-neutral-600" />
              }
              <span className={isDone ? "text-neutral-400 line-through decoration-neutral-600 text-sm" : "text-neutral-200 text-sm"}>
                {q.title}
              </span>
            </div>
            <span className={cn(
              "text-xs font-bold px-2 py-1 rounded border",
              isDone ? "text-emerald-500 border-emerald-900/50 bg-emerald-900/20" : "text-neutral-500 bg-neutral-900 border-neutral-800"
            )}>
              {q.xp} XP
            </span>
          </div>
        );
      })}
      {quests.length === 0 && <p className="text-neutral-600 text-xs">No hay misiones activas.</p>}
    </div>
  );
}
