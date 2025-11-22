import { PrismaClient } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { PillarBarChart } from "@/components/dashboard/charts";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

const PILLAR_CONFIG: any = {
  fisico: { dbName: "FISICO", label: "FÍSICO", color: "text-orange-500", barColor: "#f97316" },
  plata: { dbName: "PLATA", label: "PLATA", color: "text-emerald-500", barColor: "#10b981" },
  pensar: { dbName: "PENSAR", label: "PENSAR", color: "text-blue-500", barColor: "#3b82f6" },
  social: { dbName: "SOCIAL", label: "SOCIAL", color: "text-rose-500", barColor: "#f43f5e" },
};

export default async function PillarPage({ params }: { params: { pilar: string } }) {
  const pilarKey = params.pilar.toLowerCase();
  const config = PILLAR_CONFIG[pilarKey];

  if (!config) return notFound();

  const user = await prisma.user.findFirst({
    include: {
      stats: true,
      logsCiclo: {
        where: { pilar: config.dbName },
        orderBy: { inicio: 'desc' },
        take: 20
      },
      logsConsumo: pilarKey === 'fisico' ? { orderBy: { timestamp: 'desc' }, take: 10 } : false,
    }
  });

  if (!user || !user.stats) return <div className="p-8 text-white">Cargando...</div>;

  const xpKey = `xp${config.label[0]}${config.label.slice(1).toLowerCase()}` as keyof typeof user.stats;
  const lvlKey = `lvl${config.label[0]}${config.label.slice(1).toLowerCase()}` as keyof typeof user.stats;
  
  const currentXP = user.stats[xpKey] as number;
  const currentLvl = user.stats[lvlKey] as number;
  const targetXP = currentLvl * 100;
  const progress = Math.min(100, (currentXP / targetXP) * 100);

  const chartData = [
    { day: "LUN", xp: 0 }, { day: "MAR", xp: 0 }, { day: "MIE", xp: 0 },
    { day: "JUE", xp: 0 }, { day: "VIE", xp: 0 }, { day: "SAB", xp: currentXP > 0 ? currentXP : 10 }, { day: "DOM", xp: 0 }
  ];

  return (
    // QUITADA LA ANIMACIÓN AQUÍ PARA EVITAR EL ERROR
    <div className="p-4 md:p-8 space-y-6">
      
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="p-2 rounded-full bg-neutral-900 text-neutral-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className={`text-3xl font-bold tracking-widest uppercase ${config.color}`}>
          {config.label}
        </h1>
      </div>

      <Card className="border-neutral-800 bg-neutral-900/50">
        <CardContent className="p-8 flex flex-col md:flex-row items-center gap-8">
          <div className="relative flex items-center justify-center h-32 w-32 rounded-full bg-neutral-950 border-4 border-neutral-800">
            <span className={`text-5xl font-black ${config.color}`}>{currentLvl}</span>
          </div>
          
          <div className="flex-1 w-full space-y-2">
            <div className="flex justify-between text-sm uppercase tracking-wider text-neutral-400 font-medium">
              <span>Progreso Actual</span>
              <span className="text-white">{currentXP} <span className="text-neutral-600">/ {targetXP} XP</span></span>
            </div>
            <div className="h-3 w-full bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
              <div 
                className={`h-full transition-all duration-1000 ${config.color.replace('text-', 'bg-')}`} 
                style={{ width: `${progress}%` }} 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-neutral-800 bg-neutral-900/50">
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500 uppercase tracking-wider">Rendimiento XP (7D)</CardTitle>
          </CardHeader>
          <CardContent>
            <PillarBarChart data={chartData} />
          </CardContent>
        </Card>

        <div className="space-y-4">
           <h3 className="text-sm text-neutral-500 uppercase tracking-wider font-medium">Actividades Recientes</h3>
           
           <div className="space-y-2">
             {user.logsCiclo.map((log) => (
               <div key={log.id} className="flex items-center justify-between p-4 rounded-xl border border-neutral-800 bg-neutral-950/50 hover:bg-neutral-900 transition-colors">
                 <div>
                    <p className="font-medium text-neutral-200 text-sm">{log.tarea}</p>
                    {pilarKey === 'fisico' && log.tarea.includes("Press") && <span className="text-xs text-neutral-500">Pecho enfocado</span>}
                 </div>
                 <div className="px-3 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-xs font-bold text-neutral-400">
                   +{log.xpGanada} XP
                 </div>
               </div>
             ))}
             
             {pilarKey === 'fisico' && (
                <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-800 bg-neutral-950/50 opacity-80">
                  <div>
                    <p className="font-medium text-neutral-200 text-sm">Protocolo: Dejar Vicios</p>
                    <span className="text-xs text-neutral-500">Sistema Anti-Dopamina</span>
                  </div>
                  <div className="px-3 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-xs font-bold text-neutral-400">
                   +50 XP
                 </div>
                </div>
             )}

             {user.logsCiclo.length === 0 && <p className="text-neutral-600 text-sm italic">Sin actividad reciente.</p>}
           </div>
        </div>

      </div>
    </div>
  );
}
