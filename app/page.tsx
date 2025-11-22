import { PrismaClient } from "@prisma/client";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { EnergyChart, XPDonutChart } from "@/components/dashboard/charts"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

async function getData() {
  const user = await prisma.user.findFirst({
    where: { stats: { isNot: null } }, 
    include: {
      stats: true,
      logsCiclo: { orderBy: { inicio: 'desc' }, take: 100, where: { estado: 'COMPLETADO' } },
      logsEstado: { orderBy: { timestamp: 'asc' }, take: 30 } 
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

  // FIX: Eliminado 'p-4 md:p-8' para evitar doble espacio arriba
  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto">
      {/* HEADER */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">General</h1>
      </div>

      {/* 1. STATS GRID */}
      <div className="w-full">
         <StatsGrid stats={user.stats} />
      </div>
      
      {/* 2. CHARTS SECTION */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3 w-full">
        <EnergyChart data={energyData} />
        <XPDonutChart stats={user.stats} />
      </div>

      {/* 3. BOTTOM SECTION */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 w-full">
        <Card className="border-neutral-800 bg-neutral-900/50 text-neutral-100 h-full">
          <CardHeader>
            <CardTitle className="text-sm text-neutral-400 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-500"/>
              Control de Dopamina
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-[200px] text-neutral-600 text-sm">
             <p className="text-neutral-400 font-medium">Sistema Activo 🛡️</p>
             <p className="text-xs mt-2">Sin recaídas recientes.</p>
          </CardContent>
        </Card>
        
        <ActivityFeed logs={user.logsCiclo} />
      </div>
    </div>
  );
}
