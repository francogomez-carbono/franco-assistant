import { PrismaClient } from "@prisma/client";

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

async function getData() {
  const stats = await prisma.userStats.findFirst() || { 
    xpPlata: 0, lvlPlata: 1, xpPensar: 0, lvlPensar: 1, 
    xpFisico: 0, lvlFisico: 1, xpSocial: 0, lvlSocial: 1 
  };

  // Traemos los últimos 15 para que haya bastante para scrollear
  const logros = await prisma.logCiclo.findMany({
    where: { estado: 'COMPLETADO' },
    take: 15,
    orderBy: { fin: 'desc' }
  });

  return { stats, logros };
}

function calcularNivelGlobal(totalXP: number) {
  let nivel = 1;
  let costo = 100;
  let xp = totalXP;
  while (xp >= costo) {
    xp -= costo;
    nivel++;
    costo = nivel * 100;
  }
  return { nivel, xpRestante: xp, proximoNivel: costo };
}

export default async function Home() {
  const { stats, logros } = await getData();
  
  const totalXP = stats.xpPlata + stats.xpPensar + stats.xpFisico + stats.xpSocial;
  const global = calcularNivelGlobal(totalXP);

  const getProgress = (xp: number, lvl: number) => {
    const meta = lvl * 100;
    const porcentaje = Math.min(100, Math.round((xp / meta) * 100));
    return { porcentaje, meta };
  };

  const plata = getProgress(stats.xpPlata, stats.lvlPlata);
  const pensar = getProgress(stats.xpPensar, stats.lvlPensar);
  const fisico = getProgress(stats.xpFisico, stats.lvlFisico);
  const social = getProgress(stats.xpSocial, stats.lvlSocial);

  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30 pb-20">
      <div className="max-w-md mx-auto flex flex-col p-5">
        
        {/* HEADER */}
        <header className="mb-6 pt-4 text-center">
          <div className="relative inline-block mb-4">
            <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              LIFE OS
            </h1>
            <span className="absolute -top-1 -right-6 bg-[#111] text-[9px] px-1.5 py-0.5 rounded border border-[#333] text-neutral-400">BETA</span>
          </div>
          
          {/* TARJETA DE NIVEL GLOBAL */}
          <div className="bg-[#111] border border-[#222] p-5 rounded-2xl shadow-2xl relative overflow-hidden group">
            <div className="flex justify-between items-center mb-3 relative z-10">
              {/* Izquierda: Nombre limpio */}
              <div className="text-left">
                <p className="text-2xl font-black text-white tracking-wider">FRANCO</p>
              </div>
              
              {/* Derecha: LVL + Número dorado */}
              <div className="text-right flex items-baseline gap-1.5">
                <span className="text-xs font-bold text-neutral-600 tracking-widest">LVL</span>
                <p className="text-3xl font-black text-yellow-400 leading-none">{global.nivel}</p>
              </div>
            </div>
            
            {/* Barra de XP */}
            <div className="relative z-10">
                <div className="flex justify-between text-[10px] text-neutral-600 font-mono mb-1.5">
                    <span>XP TOTAL: {totalXP}</span>
                    <span>{global.xpRestante} / {global.proximoNivel}</span>
                </div>
                <div className="h-2 w-full bg-[#000] rounded-full overflow-hidden border border-[#222]">
                    <div 
                        className="h-full bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)] transition-all duration-1000"
                        style={{ width: `${(global.xpRestante / global.proximoNivel) * 100}%` }} 
                    />
                </div>
            </div>
          </div>
        </header>

        {/* STATS GRID (ESTILO COMPACTO) */}
        <div className="space-y-3 mb-12">
          <StatCard emoji="💰" title="PLATA" lvl={stats.lvlPlata} xp={stats.xpPlata} meta={plata.meta} progress={plata.porcentaje} color="bg-emerald-500" />
          <StatCard emoji="🧠" title="PENSAR" lvl={stats.lvlPensar} xp={stats.xpPensar} meta={pensar.meta} progress={pensar.porcentaje} color="bg-blue-500" />
          <StatCard emoji="💪" title="FÍSICO" lvl={stats.lvlFisico} xp={stats.xpFisico} meta={fisico.meta} progress={fisico.porcentaje} color="bg-red-500" />
          <StatCard emoji="❤️" title="SOCIAL" lvl={stats.lvlSocial} xp={stats.xpSocial} meta={social.meta} progress={social.porcentaje} color="bg-pink-500" />
        </div>

        {/* BITÁCORA - Separada con margen para scrollear */}
        <section className="border-t border-[#222] pt-8">
          <div className="flex items-center justify-center mb-6 opacity-50">
            <span className="text-[10px] uppercase tracking-widest text-neutral-500">▼ Scroll para historial ▼</span>
          </div>

          <h3 className="text-[#444] text-[10px] font-bold tracking-[0.2em] mb-4 uppercase text-left">Bitácora de Logros</h3>
          
          <div className="space-y-2">
            {logros.length === 0 ? (
              <div className="text-neutral-800 text-xs text-center py-8 border border-dashed border-[#222] rounded-lg">
                Sin actividad reciente.
              </div>
            ) : (
              logros.map((log) => (
                <div key={log.id} className="bg-[#0a0a0a] border border-[#222] p-3 rounded-lg flex items-center justify-between transition-colors hover:border-[#333]">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-6 h-6 min-w-[24px] rounded-full bg-[#111] border border-[#222] flex items-center justify-center text-[10px] text-green-500">✓</div>
                    <span className="text-neutral-400 text-xs font-medium truncate">{log.tarea}</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#444] bg-[#111] px-2 py-1 rounded border border-[#222] min-w-[50px] text-center">+{log.xpGanada} XP</span>
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </main>
  );
}

function StatCard({ emoji, title, lvl, xp, meta, progress, color }: any) {
  return (
    <div className="bg-[#111] border border-[#222] p-4 rounded-xl shadow-sm hover:border-[#333] transition-all">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <div className="text-xl bg-[#1a1a1a] w-10 h-10 flex items-center justify-center rounded-lg border border-[#2a2a2a]">{emoji}</div>
          <div>
            <h2 className="font-bold text-sm text-neutral-200 tracking-wide">{title}</h2>
            <p className="text-[10px] text-neutral-500 font-bold">NIVEL <span className="text-white">{lvl}</span></p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-neutral-500 font-bold mb-0.5">XP</p>
          <p className="text-xs font-mono text-neutral-400">{xp} <span className="text-[#333]">/ {meta}</span></p>
        </div>
      </div>
      <div className="h-2 w-full bg-[#000] rounded-full overflow-hidden border border-[#222]">
        <div className={`h-full ${color} transition-all duration-700 ease-out`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}