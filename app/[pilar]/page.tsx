import { PrismaClient } from "@prisma/client";
import { ChartContainer } from "@/components/ChartContainer";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

async function getData(pilar: string) {
  if (!pilar) return null;

  const decoded = decodeURIComponent(pilar);
  
  const pilarEnum = decoded
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase() as "PLATA" | "PENSAR" | "FISICO" | "SOCIAL";
  
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

  const ciclos = await prisma.logCiclo.findMany({
    where: { 
      pilar: finalPilar, 
      inicio: { gte: hace30dias }, 
      xpGanada: { gt: 0 } 
    },
    orderBy: { inicio: 'asc' }
  });
  
  let consumos: any[] = [];
  if (finalPilar === "FISICO") {
    consumos = await prisma.logConsumo.findMany({
      where: { timestamp: { gte: hace30dias }, xpGanada: { gt: 0 } },
      orderBy: { timestamp: 'asc' }
    });
  }

  let estados: any[] = [];
  if (finalPilar === "FISICO" || finalPilar === "PENSAR") { 
      estados = await prisma.logEstado.findMany({
          where: { timestamp: { gte: hace30dias }, xpGanada: { gt: 0 } },
          orderBy: { timestamp: 'asc' }
      });
  }

  let adicciones: any[] = [];
  if (finalPilar === "FISICO") {
      const adds = await prisma.addiction.findMany({
          where: { inicio: { gte: hace30dias } }
      });
      adicciones = adds.map(a => ({
          id: a.id,
          tarea: `Protocolo: Dejar ${capitalize(a.nombre)}`,
          xpGanada: 50,
          fecha: a.inicio
      }));
  }

  const logs = [
      ...ciclos.map(c => ({ ...c, fecha: c.fin || c.inicio })),
      ...consumos.map(c => ({ ...c, fecha: c.timestamp, tarea: c.descripcion })),
      ...estados.map(e => ({ ...e, fecha: e.timestamp, tarea: "Check-in de Estado" })),
      ...adicciones
  ];

  return { pilarTitle: decoded.toUpperCase(), pilarEnum: finalPilar, currentStat, logs };
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

  const { pilarTitle, pilarEnum, currentStat, logs } = data;
  
  // --- COLORES AJUSTADOS (Usamos el tono 400 para la barra también) ---
  const styles: any = {
    "PLATA": {
      text: "text-emerald-400",
      bgGlow: "bg-emerald-400",
      bar: "bg-emerald-400",
    },
    "PENSAR": {
      text: "text-blue-400",
      bgGlow: "bg-blue-400",
      bar: "bg-blue-400",
    },
    "FISICO": {
      text: "text-red-400",
      bgGlow: "bg-red-400",
      bar: "bg-red-400",
    },
    "SOCIAL": {
      text: "text-pink-400",
      bgGlow: "bg-pink-400",
      bar: "bg-pink-400",
    }
  };
  
  const style = styles[pilarEnum] || styles["PLATA"];

  const metaXP = (currentStat?.lvl || 1) * 100;
  const xpActual = currentStat?.xp || 0;
  const porcentaje = Math.min(100, (xpActual / metaXP) * 100);

  return (
    <main className="min-h-screen bg-[#050505] text-white p-5 pb-20 font-sans">
      <div className="max-w-md mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="p-2.5 bg-[#111] rounded-full border border-[#222] hover:bg-[#222] hover:border-[#444] transition-all active:scale-95">
            <ArrowLeft size={18} className="text-neutral-400" />
          </Link>
          <h1 className={`text-xl font-black tracking-wide ${style.text}`}>{pilarTitle}</h1>
        </div>

        {/* --- DISEÑO "THE ORB" (Modificado) --- */}
        {/* Quitamos 'justify-between' */}
        <div className="relative mb-10 p-6 bg-[#080808] border border-[#222] rounded-3xl overflow-hidden flex items-center group">
          <div className={`absolute left-0 top-0 w-40 h-full ${style.bgGlow} opacity-10 blur-3xl`}></div>

          {/* Agregamos 'w-full' al contenedor principal */}
          <div className="relative z-10 flex items-center gap-6 w-full">
            {/* El Orbe */}
            <div className={`w-20 h-20 rounded-full border-4 border-[#151515] flex items-center justify-center bg-[#050505] shadow-[0_0_30px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-500`}>
              <span className={`text-4xl font-black ${style.text}`}>{currentStat?.lvl || 1}</span>
            </div>
            
            {/* Agregamos 'flex-1' para que ocupe el espacio restante */}
            <div className="flex-1">
              <h2 className="text-[10px] font-bold text-neutral-500 tracking-widest uppercase mb-1.5">PROGRESO ACTUAL</h2>
              <p className="text-white text-xl font-black tracking-tight">
                {xpActual} <span className="text-neutral-600 text-xs font-medium">/ {metaXP} XP</span>
              </p>
              
              {/* Barra ancha (w-full) */}
              <div className="h-1.5 w-full bg-[#222] rounded-full mt-3 overflow-hidden">
                <div 
                    className={`h-full ${style.bar} shadow-[0_0_10px_currentColor] transition-all duration-1000`} 
                    style={{ width: `${porcentaje}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          {/* SECCIÓN "TOTAL" ELIMINADA AQUÍ */}
        </div>
        {/* ------------------------ */}

        <section className="mb-10">
           <ChartContainer logs={logs} color={style.text.replace('text-', '')} />
        </section>

        <section>
          <h3 className="text-[#444] text-[10px] font-bold tracking-[0.2em] mb-4 uppercase">Actividades Recientes</h3>
          <div className="space-y-2">
            {logs.sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).slice(0, 15).map((item: any, i) => (
               <div key={i} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-lg flex justify-between items-center transition-colors hover:border-[#333]">
                  <span className="text-xs text-neutral-300 font-medium truncate max-w-[200px]">{item.tarea || item.descripcion}</span>
                  <span className="text-[10px] font-bold text-[#444] bg-[#111] px-2 py-1 rounded border border-[#222]">+{item.xpGanada} XP</span>
               </div>
            ))}
            {logs.length === 0 && (
                <div className="text-neutral-800 text-xs text-center py-8 border border-dashed border-[#222] rounded-lg">Sin datos aún en este pilar.</div>
            )}
          </div>
        </section>

      </div>
    </main>
  );
}