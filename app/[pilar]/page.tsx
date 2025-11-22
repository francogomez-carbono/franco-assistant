import { PrismaClient } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PillarBarChart } from "@/components/dashboard/charts";
import { InteractiveHistory, InteractiveQuests } from "@/components/dashboard/interactive-lists";
import { notFound } from "next/navigation";
import { ArrowLeft, Target } from "lucide-react";
import Link from "next/link";

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

const MY_TELEGRAM_ID = "5002389519"; // TU ID

const PILLAR_CONFIG: any = {
  fisico: { dbName: "FISICO", label: "FÍSICO", xpField: "xpFisico", lvlField: "lvlFisico", color: "text-orange-500", barColor: "#f97316" },
  plata: { dbName: "PLATA", label: "PLATA", xpField: "xpPlata", lvlField: "lvlPlata", color: "text-emerald-500", barColor: "#10b981" },
  pensar: { dbName: "PENSAR", label: "PENSAR", xpField: "xpPensar", lvlField: "lvlPensar", color: "text-blue-500", barColor: "#3b82f6" },
  social: { dbName: "SOCIAL", label: "SOCIAL", xpField: "xpSocial", lvlField: "lvlSocial", color: "text-rose-500", barColor: "#f43f5e" },
};

export default async function PillarPage({ params }: { params: Promise<{ pilar: string }> }) {
  const resolvedParams = await params;
  const pilarKey = resolvedParams.pilar.toLowerCase();
  const config = PILLAR_CONFIG[pilarKey];

  if (!config) return notFound();

  // CAMBIO: Usar findUnique con tu ID
  const user = await prisma.user.findUnique({
    where: { telegramId: MY_TELEGRAM_ID },
    include: {
      stats: true,
      logsCiclo: {
        where: { pilar: config.dbName },
        orderBy: { inicio: 'desc' },
        take: 50 
      },
      logsHabito: {
        orderBy: { timestamp: 'desc' },
        take: 50
      },
      questPresets: {
        where: { pilar: config.dbName }
      }
    }
  });

  if (!user || !user.stats) return <div className="p-8 text-white">Cargando...</div>;

  // ... (EL RESTO DEL CÓDIGO SIGUE IGUAL, NO LO BORRES) ...
  // Solo copia hasta aquí si quieres, o asegúrate de mantener la lógica de abajo.
  
  // --- CÁLCULOS DE NIVEL ---
  const rawXP = (user.stats[config.xpField as keyof typeof user.stats] as number) || 0;
  const currentXP = Math.max(0, rawXP);
  const currentLvl = (user.stats[config.lvlField as keyof typeof user.stats] as number) || 1;
  const targetXP = currentLvl * 100;
  const progress = targetXP > 0 ? Math.min(100, (currentXP / targetXP) * 100) : 0;

  // --- HISTORIAL UNIFICADO ---
  const quests = user.questPresets; 
  const combinedHistory = [
    ...user.logsCiclo.map(l => ({ 
      id: l.id, tarea: l.tarea, xpGanada: l.xpGanada, inicio: l.inicio, type: 'CICLO' 
    })),
    ...user.logsHabito
      .filter(h => quests.some(qp => qp.title === h.nombre)) 
      .map(h => ({ 
      id: h.id, tarea: h.nombre, xpGanada: h.xpGanada, inicio: h.timestamp, type: 'HABITO' 
    }))
  ].sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime())
   .slice(0, 50);

  // --- GRÁFICO ---
  const days = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dayLabel = days[d.getDay()];
    const start = new Date(d.setHours(0,0,0,0)); const end = new Date(d.setHours(23,59,59,999));
    
    const dayXP = combinedHistory
      .filter(l => new Date(l.inicio) >= start && new Date(l.inicio) <= end)
      .reduce((sum, l) => sum + l.xpGanada, 0);

    chartData.push({ day: dayLabel, xp: dayXP });
  }

  // --- CHECKBOXES ---
  const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
  const completedMap: Record<string, boolean> = {};
  user.logsHabito.forEach(log => {
    if (new Date(log.timestamp) >= startOfToday) completedMap[log.nombre] = true;
  });

  return (
    <div className="p-4 md:p-8 space-y-6 w-full animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/" className="p-2 rounded-full bg-neutral-900 text-neutral-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className={`text-3xl font-bold tracking-widest uppercase ${config.color}`}>{config.label}</h1>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* NIVEL */}
        <Card className="border-neutral-800 bg-neutral-900/50 h-full">
          <CardHeader><CardTitle className="text-sm text-neutral-500 uppercase tracking-wider">Nivel Actual</CardTitle></CardHeader>
          <CardContent className="flex flex-row items-center gap-6 pb-8">
            <div className="relative flex items-center justify-center h-24 w-24 rounded-full bg-neutral-950 border-4 border-neutral-800 shrink-0">
              <span className={`text-4xl font-black ${config.color}`}>{currentLvl}</span>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex justify-between text-xs uppercase tracking-wider text-neutral-400 font-medium"><span>XP Acumulada</span><span className="text-white">{currentXP} <span className="text-neutral-600">/ {targetXP}</span></span></div>
              <div className="h-3 w-full bg-neutral-950 rounded-full overflow-hidden border border-neutral-800"><div className={`h-full transition-all duration-1000 ${config.color.replace('text-', 'bg-')}`} style={{ width: `${progress}%` }} /></div>
              <p className="text-xs text-neutral-500 pt-1">Sigue así para alcanzar el Nivel {currentLvl + 1}.</p>
            </div>
          </CardContent>
        </Card>

        {/* RENDIMIENTO */}
        <Card className="border-neutral-800 bg-neutral-900/50 h-full">
          <CardHeader><CardTitle className="text-sm text-neutral-500 uppercase tracking-wider">Rendimiento XP (7D)</CardTitle></CardHeader>
          <CardContent><PillarBarChart data={chartData} /></CardContent>
        </Card>

        {/* MISIONES */}
        <Card className="border-neutral-800 bg-neutral-900/50 h-full">
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500 uppercase tracking-wider flex items-center gap-2"><Target className="h-4 w-4 text-white" />Misiones Diarias</CardTitle>
          </CardHeader>
          <CardContent>
            <InteractiveQuests quests={quests} completedMap={completedMap} pilar={config.dbName} userId={user.id} />
          </CardContent>
        </Card>

        {/* HISTORIAL */}
        <div className="flex flex-col h-full">
           <h3 className="text-sm text-neutral-500 uppercase tracking-wider font-medium mb-4 ml-1">Historial</h3>
           <InteractiveHistory logs={combinedHistory} pilar={config.label} userId={user.id} />
        </div>
      </div>
    </div>
  );
}