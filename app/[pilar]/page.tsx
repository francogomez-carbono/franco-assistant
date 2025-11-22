import { PrismaClient } from "@prisma/client";
import { ChartContainer } from "@/components/ChartContainer";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

async function getData(pilar: string) {
  if (!pilar) return null;

  // 1. Decodificar URL (por si viene como F%C3%ADSICO)
  const decoded = decodeURIComponent(pilar);
  
  // 2. Quitar acentos y pasar a mayúsculas para matchear Prisma Enum (FÍSICO -> FISICO)
  const pilarEnum = decoded
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase() as "PLATA" | "PENSAR" | "FISICO" | "SOCIAL";
  
  // Mapa de seguridad por si falla la limpieza
  const validPilars = ["PLATA", "PENSAR", "FISICO", "SOCIAL"];
  const finalPilar = validPilars.includes(pilarEnum) ? pilarEnum : "PLATA";

  const stats = await prisma.userStats.findFirst();
  const map = {
    "PLATA": { xp: stats?.xpPlata, lvl: stats?.lvlPlata },
    "PENSAR": { xp: stats?.xpPensar, lvl: stats?.lvlPensar },
    "FISICO": { xp: stats?.xpFisico, lvl: stats?.lvlFisico },
    "SOCIAL": { xp: stats?.xpSocial, lvl: stats?.lvlSocial }
  };
  
  const currentStat = map[finalPilar] || map["PLATA"];

  const hace30dias = new Date();
  hace30dias.setDate(hace30dias.getDate() - 30);

  const logs = await prisma.logCiclo.findMany({
    where: { pilar: finalPilar, fin: { gte: hace30dias }, estado: 'COMPLETADO' },
    orderBy: { fin: 'asc' }
  });
  
  let consumos: any[] = [];
  if (finalPilar === "FISICO") {
    consumos = await prisma.logConsumo.findMany({
      where: { timestamp: { gte: hace30dias }, xpGanada: { gt: 0 } },
      orderBy: { timestamp: 'asc' }
    });
  }

  return { pilarTitle: decoded.toUpperCase(), pilarEnum: finalPilar, currentStat, logs, consumos };
}

type Props = {
  params: Promise<{ pilar: string }>
}

export default async function PilarPage({ params }: Props) {
  const resolvedParams = await params;
  const pilarRaw = resolvedParams?.pilar;

  if (!pilarRaw) return <div className="p-10 text-white">Cargando...</div>;

  const data = await getData(pilarRaw);
  if (!data) return <div className="p-10 text-white">Pilar no encontrado</div>;

  const { pilarTitle, pilarEnum, currentStat, logs, consumos } = data;
  
  const colors: any = {
    "PLATA": "text-emerald-400 border-emerald-900/30 bg-emerald-950/10",
    "PENSAR": "text-blue-400 border-blue-900/30 bg-blue-950/10",
    "FISICO": "text-red-400 border-red-900/30 bg-red-950/10",
    "SOCIAL": "text-pink-400 border-pink-900/30 bg-pink-950/10"
  };
  const theme = colors[pilarEnum] || colors["PLATA"];

  return (
    <main className="min-h-screen bg-[#050505] text-white p-5 pb-20 font-sans">
      <div className="max-w-md mx-auto">
        
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="p-2.5 bg-[#111] rounded-full border border-[#222] hover:bg-[#222] hover:border-[#444] transition-all active:scale-95">
            <ArrowLeft size={18} className="text-neutral-400" />
          </Link>
          {/* Usamos pilarTitle para mostrar FÍSICO (con tilde) lindo en el título */}
          <h1 className={`text-xl font-black tracking-wide ${theme.split(' ')[0]}`}>{pilarTitle}</h1>
        </div>

        <div className={`p-6 rounded-2xl border mb-8 ${theme}`}>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] font-bold opacity-70 mb-1 tracking-widest">NIVEL ACTUAL</p>
              <p className="text-5xl font-black leading-none">{currentStat?.lvl || 1}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold opacity-70 mb-1 tracking-widest">XP TOTAL</p>
              <p className="text-xl font-mono font-bold">{currentStat?.xp || 0}</p>
            </div>
          </div>
        </div>

        <section className="mb-10">
           <ChartContainer logs={logs} consumos={consumos} color={theme.split(' ')[0].replace('text-', '')} />
        </section>

        <section>
          <h3 className="text-[#444] text-[10px] font-bold tracking-[0.2em] mb-4 uppercase">Actividades Recientes</h3>
          <div className="space-y-2">
            {[...logs, ...consumos].sort((a,b) => new Date(b.fin || b.timestamp).getTime() - new Date(a.fin || a.timestamp).getTime()).slice(0, 10).map((item: any, i) => (
               <div key={i} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-lg flex justify-between items-center transition-colors hover:border-[#333]">
                  <span className="text-xs text-neutral-300 font-medium truncate max-w-[200px]">{item.tarea || item.descripcion}</span>
                  <span className="text-[10px] font-bold text-[#444] bg-[#111] px-2 py-1 rounded border border-[#222]">+{item.xpGanada} XP</span>
               </div>
            ))}
            {[...logs, ...consumos].length === 0 && (
                <div className="text-neutral-800 text-xs text-center py-8 border border-dashed border-[#222] rounded-lg">Sin datos aún en este pilar.</div>
            )}
          </div>
        </section>

      </div>
    </main>
  );
}