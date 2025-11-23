import { PrismaClient } from "@prisma/client";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { EnergyChart, XPDonutChart } from "@/components/dashboard/charts"; 
import { DopamineWidget } from "@/components/dashboard/dopamine-widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

const MY_TELEGRAM_ID = "5002389519";

async function getData() {
  const user = await prisma.user.findUnique({
    where: { telegramId: MY_TELEGRAM_ID }, 
    include: {
      stats: true,
      // 1. Ciclos (Bot)
      logsCiclo: { orderBy: { inicio: 'desc' }, take: 20, where: { estado: 'COMPLETADO' } },
      // 2. Estados (Gráficos)
      logsEstado: { orderBy: { timestamp: 'asc' }, take: 30 },
      // 3. Dopamina
      dopamineLogs: { orderBy: { fecha: 'desc' }, take: 1 },
      addictions: { orderBy: { inicio: 'desc' } },
      // 4. Hábitos (Misiones) y Presets (Para saber el pilar)
      logsHabito: { orderBy: { timestamp: 'desc' }, take: 20 },
      questPresets: true
    }
  });
  return user;
}

export default async function Dashboard() {
  const user = await getData();

  if (!user || !user.stats) return <div className="p-8 text-white">Cargando...</div>;

  const energyData = user.logsEstado.map(log => ({
    fecha: log.timestamp.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
    energia: log.energia || 0,
    foco: log.concentracion || 0
  }));

  // --- FUSIÓN DE HISTORIAL PARA EL FEED ---
  const combinedLogs = [
    // A. Ciclos (Ya tienen pilar)
    ...user.logsCiclo.map(l => ({
      id: l.id,
      tarea: l.tarea,
      pilar: l.pilar, // Ej: FISICO
      xpGanada: l.xpGanada,
      inicio: l.inicio
    })),
    // B. Hábitos (No tienen pilar directo, lo buscamos en los presets)
    ...user.logsHabito.map(h => {
      // Buscamos si este hábito coincide con alguna misión configurada para saber su pilar
      const preset = user.questPresets.find(p => p.title === h.nombre);
      return {
        id: h.id,
        tarea: h.nombre,
        pilar: preset ? preset.pilar : "DEFAULT", // Si no encuentra, pone default
        xpGanada: h.xpGanada,
        inicio: h.timestamp
      };
    })
  ]
  // Ordenar todo por fecha (lo más nuevo arriba)
  .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime())
  .slice(0, 10); // Mostrar solo los últimos 10

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">General</h1>
      </div>

      <div className="w-full">
         <StatsGrid stats={user.stats} />
      </div>
      
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3 w-full">
        <EnergyChart data={energyData} />
        <XPDonutChart stats={user.stats} />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 w-full">
        {/* WIDGET DE DOPAMINA */}
        <Card className="border-neutral-800 bg-neutral-900/50 text-neutral-100 h-full">
          <CardHeader>
            <CardTitle className="text-sm text-neutral-400 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-500"/>
              Escudo de Dopamina
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[200px]">
             <DopamineWidget 
               addictions={user.addictions}
               userId={user.id}
             />
          </CardContent>
        </Card>
        
        {/* FEED CON ICONOS */}
        <ActivityFeed logs={combinedLogs} />
      </div>
    </div>
  );
}