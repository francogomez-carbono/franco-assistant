import { PrismaClient } from "@prisma/client";
import { DashboardHeader } from "@/components/dashboard/header";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { EnergyChart, ProductivityHeatmap } from "@/components/dashboard/charts"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

async function getData() {
  const user = await prisma.user.findFirst({
    where: { stats: { isNot: null } }, 
    include: {
      stats: true,
      logsCiclo: { 
        orderBy: { inicio: 'desc' }, 
        take: 100,
        where: { estado: 'COMPLETADO' }
      },
      logsEstado: {
        orderBy: { timestamp: 'asc' },
        take: 30,
      }
    }
  });
  return user;
}

export default async function Dashboard() {
  const user = await getData();

  if (!user || !user.stats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Esperando conexión...</h2>
          <p>Envía <code>/nivel</code> a tu bot de Telegram para iniciar.</p>
        </div>
      </div>
    );
  }

  const energyData = user.logsEstado.map(log => ({
    fecha: log.timestamp.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }),
    energia: log.energia || 0,
    foco: log.concentracion || 0
  }));

  return (
    <main className="min-h-screen bg-neutral-950 p-8 font-sans">
      <DashboardHeader />
      <StatsGrid stats={user.stats} />
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mb-4">
        <EnergyChart data={energyData} />
        <ProductivityHeatmap logs={user.logsCiclo} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <ActivityFeed logs={user.logsCiclo} />
        <Card className="border-neutral-800 bg-neutral-900/50 text-neutral-100">
          <CardHeader><CardTitle className="text-sm text-neutral-400">Control de Dopamina</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-[150px] text-neutral-600 text-sm">
             <p>Sistema Activo 🛡️</p>
             <p className="text-xs mt-2">Sin recaídas recientes.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
