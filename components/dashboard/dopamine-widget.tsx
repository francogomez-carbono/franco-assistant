"use client";

import { Shield, ShieldCheck, Skull, Plus, RefreshCw, Trash2 } from "lucide-react";
import { createAddiction, relapseAddiction, deleteAddiction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { cn } from "@/lib/utils";

const RANKS = [
  { days: 0, title: "Recaída", color: "text-red-500", icon: Skull },
  { days: 1, title: "Novato", color: "text-neutral-400", icon: Shield },
  { days: 3, title: "Aprendiz", color: "text-blue-400", icon: Shield },
  { days: 7, title: "Guerrero", color: "text-indigo-400", icon: ShieldCheck },
  { days: 14, title: "Veterano", color: "text-purple-400", icon: ShieldCheck },
  { days: 30, title: "Maestro", color: "text-orange-400", icon: ShieldCheck },
  { days: 90, title: "LEYENDA", color: "text-yellow-400", icon: ShieldCheck },
];

export function DopamineWidget({ addictions, userId }: { addictions: any[], userId: string }) {
  const [newAddiction, setNewAddiction] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleCreate = async () => {
    if (!newAddiction.trim()) return;
    await createAddiction(newAddiction, userId);
    setNewAddiction("");
    setIsAdding(false);
  };

  const handleRelapse = async (id: string, name: string) => {
    if (!confirm(`¿Recaíste en ${name}? Se reiniciará a 0.`)) return;
    await relapseAddiction(id, userId);
  };

  return (
    <div className="h-full flex flex-col">
      {/* LISTA SCROLLABLE */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar min-h-[120px]">
        {addictions.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-neutral-600 space-y-2">
            <Shield className="h-8 w-8 opacity-20" />
            <p className="text-xs">No estás traqueando nada.</p>
          </div>
        )}

        {addictions.map((addiction) => {
          const now = new Date();
          const last = new Date(addiction.ultimoRelapso);
          const diffTime = Math.abs(now.getTime() - last.getTime());
          const daysClean = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          // Calcular Rango
          const rank = RANKS.slice().reverse().find(r => daysClean >= r.days) || RANKS[0];
          const Icon = rank.icon;

          return (
            <div key={addiction.id} className="group flex items-center justify-between p-3 bg-neutral-950 border border-neutral-800 rounded-lg hover:border-neutral-700 transition-all">
              
              {/* IZQUIERDA: ICONO Y DATOS */}
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-md bg-neutral-900", rank.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-200">{addiction.nombre}</p>
                  <p className={cn("text-xs font-bold", rank.color)}>
                    {daysClean} Días <span className="text-neutral-600 font-normal">• {rank.title}</span>
                  </p>
                </div>
              </div>

              {/* DERECHA: ACCIONES */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  size="icon" variant="ghost" 
                  className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-950/30"
                  onClick={() => handleRelapse(addiction.id, addiction.nombre)}
                  title="Registrar Recaída"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button 
                  size="icon" variant="ghost" 
                  className="h-8 w-8 text-neutral-600 hover:text-neutral-400"
                  onClick={() => deleteAddiction(addiction.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* INPUT PARA AGREGAR */}
      <div className="pt-4 border-t border-neutral-800 mt-2">
        {isAdding ? (
          <div className="flex gap-2">
            <Input 
              placeholder="Ej: Azúcar..." 
              value={newAddiction}
              onChange={(e) => setNewAddiction(e.target.value)}
              className="h-8 text-xs bg-neutral-900 border-neutral-700"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <Button size="sm" onClick={handleCreate} className="h-8 px-3 bg-white text-black hover:bg-neutral-200">OK</Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="h-8 w-8 p-0">✕</Button>
          </div>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsAdding(true)}
            className="w-full border-dashed border-neutral-800 text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300 h-8 text-xs"
          >
            <Plus className="h-3 w-3 mr-2" /> Agregar vicio para dejar
          </Button>
        )}
      </div>
    </div>
  );
}