import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Brain, DollarSign, Heart, Circle, Timer } from "lucide-react";

const PILLAR_ICONS: any = {
  "FISICO": { icon: Zap, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  "PLATA": { icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  "PENSAR": { icon: Brain, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  "SOCIAL": { icon: Heart, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  "DEFAULT": { icon: Circle, color: "text-neutral-500", bg: "bg-neutral-800", border: "border-neutral-800" }
};

export function ActivityFeed({ logs }: { logs: any[] }) {
  return (
    <Card className="border-neutral-800 bg-neutral-900/50 text-neutral-100 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-neutral-500">
          Historial Reciente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
        {logs.map((log) => {
          const pilarData = PILLAR_ICONS[log.pilar] || PILLAR_ICONS["DEFAULT"];
          const Icon = pilarData.icon;

          return (
            <div key={log.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-900/80 transition-colors group border border-transparent hover:border-neutral-800">
              <div className="flex items-center gap-4 min-w-0">
                {/* ICONO */}
                <div className={`p-2 rounded-lg ${pilarData.bg} ${pilarData.border} border shrink-0`}>
                  <Icon className={`h-4 w-4 ${pilarData.color}`} />
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-sm text-neutral-200 truncate pr-4">
                    {log.tarea}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <Timer className="h-3 w-3" />
                    <span suppressHydrationWarning>
                      {new Date(log.inicio).toLocaleDateString('es-AR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* ESTILO DE RECTÁNGULO GRIS (Igual a páginas internas) */}
              <span className="px-2 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-xs font-bold text-neutral-400 group-hover:bg-neutral-800 group-hover:text-neutral-300 transition-colors shrink-0">
                +{log.xpGanada} XP
              </span>
            </div>
          );
        })}
        
        {logs.length === 0 && (
          <div className="h-20 flex items-center justify-center text-xs text-neutral-600 italic">
            Sin datos recientes.
          </div>
        )}
      </CardContent>
    </Card>
  );
}