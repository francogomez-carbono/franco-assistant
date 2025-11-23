"use client";

import { CheckCircle, Circle, Timer, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleQuest, deleteActivity } from "@/app/actions"; // Importamos las acciones
import Link from "next/link";
import { useState } from "react";

// --- MISIONES CON CHECKBOX (Para Páginas Internas) ---
export function InteractiveQuests({ quests, completedMap, pilar, userId }: { quests: any[], completedMap: Record<string, boolean>, pilar: string, userId: string }) {
  
  const handleToggle = async (title: string, xp: number, currentStatus: boolean) => {
    // Optimistic update visual (opcional, aquí confiamos en revalidatePath del server action)
    await toggleQuest(title, xp, pilar, userId, currentStatus);
  };

  return (
    <div className="space-y-3">
      {quests.map((quest) => {
        const isCompleted = completedMap[quest.title];
        
        return (
          <div 
            key={quest.id} 
            onClick={() => handleToggle(quest.title, quest.xp, isCompleted)}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer select-none group",
              isCompleted 
                ? "bg-emerald-950/20 border-emerald-900/50 text-emerald-400 hover:bg-emerald-950/30" 
                : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
            )}
          >
            <div className="flex items-center gap-3">
              {isCompleted ? <CheckCircle className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-neutral-600 group-hover:text-neutral-400" />}
              <span className="text-sm font-medium">{quest.title}</span>
            </div>
            <span className={cn("text-xs font-bold px-2 py-1 rounded-md", isCompleted ? "bg-emerald-900/50 text-emerald-400" : "bg-neutral-900 text-neutral-500")}>
              {quest.xp} XP
            </span>
          </div>
        );
      })}
      {quests.length === 0 && <p className="text-neutral-600 text-xs italic">Sin misiones configuradas.</p>}
    </div>
  );
}

// --- HISTORIAL CON DELETE (Para Páginas Internas) ---
export function InteractiveHistory({ logs, pilar, userId }: { logs: any[], pilar: string, userId: string }) {
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const handleDelete = async (id: string, xp: number) => {
    if (!confirm("¿Borrar actividad y restar XP?")) return;
    setDeletedIds(prev => new Set(prev).add(id));
    await deleteActivity(id, xp, pilar, userId);
  };

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
      {logs.length === 0 && <div className="text-center text-neutral-600 py-8 text-sm">Sin actividad registrada.</div>}
      
      {logs.map((log) => {
        if (deletedIds.has(log.id)) return null;

        return (
          <div key={log.id} className="flex items-center justify-between p-3 bg-neutral-950/50 border border-neutral-800 rounded-lg hover:border-neutral-700 transition-colors group">
            {/* IZQUIERDA: TEXTOS */}
            <div className="flex flex-col mr-4 min-w-0">
              <span className="text-sm font-medium text-neutral-200 truncate">{log.tarea}</span>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Timer className="h-3 w-3" />
                <span suppressHydrationWarning>
                  {new Date(log.inicio).toLocaleDateString('es-AR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* DERECHA: ACCIONES Y XP */}
            <div className="flex items-center gap-3 shrink-0">
              {/* 1. BOTÓN BORRAR (Ahora a la izquierda) */}
              <button 
                onClick={() => handleDelete(log.id, log.xpGanada)}
                className="p-1.5 text-neutral-600 hover:text-red-500 hover:bg-red-900/20 rounded transition-all opacity-0 group-hover:opacity-100"
                title="Borrar"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              {/* 2. BADGE XP (Ahora a la derecha, siempre alineado) */}
              <span className="text-xs font-bold text-neutral-300 bg-neutral-900 px-2 py-1 rounded-md border border-neutral-800 min-w-[50px] text-center">
                +{log.xpGanada} XP
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}