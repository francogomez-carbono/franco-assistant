import { PrismaClient } from "@prisma/client";

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

async function getData() {
  const stats = await prisma.userStats.findFirst() || { 
    xpPlata: 0, lvlPlata: 1, xpPensar: 0, lvlPensar: 1, 
    xpFisico: 0, lvlFisico: 1, xpSocial: 0, lvlSocial: 1 
  };

  const logros = await prisma.logCiclo.findMany({
    where: { estado: 'COMPLETADO' },
    take: 10, // Traemos más para que valga la pena el scroll
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
    <main className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-purple-500/30 pb-32">
      <div className="max-w-md mx-auto flex flex-col p-6">
        
        {/* HEADER - Más espacio arriba y abajo */}
        <header className="mb-12 text-center space-y-6 pt-12">
          <div className="relative inline-block">
            <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              LIFE OS
            </h1>
            <span className="absolute -top-2 -right-8 bg-neutral-800 text-[10px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-400">BETA</span>
          </div>
          
          <div className="flex justify-center gap-4 text-sm font-mono text-neutral-400">
            <div className="bg-neutral-900/80 px-4 py-2 rounded-xl border border-neutral-800">
              PLAYER: <span className="text-white font-bold">FRANCO</span>
            </div>
            <div className="bg-neutral-900/80 px-4 py-2 rounded-xl border border-neutral-800">
              LVL: <span className="text-yellow-400 font-bold text-lg">{global.nivel}</span>
            </div>
          </div>

          {/* BARRA GLOBAL */}
          <div className="px-2 mt-4">
             <div className="flex justify-between text-[10px] text-neutral-600 font-mono mb-2">
                <span>XP TOTAL: {totalXP}</span>
                <span>NEXT LVL: {global.xpRestante}/{global.proximoNivel}</span>
             </div>
             <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                <div className="h-full bg-yellow-400/80 shadow-[0_0_15px_rgba(250,204,21,0.6)] transition-all duration-1000"
                  style={{ width: `${(global.xpRestante / global.proximoNivel) * 100}%` }} />
             </div>
          </div>
        </header>

        {/* STATS GRID - Mucho más espaciado vertical (space-y-6) */}
        <div className="space-y-6 mb-24">
          <StatCard emoji="💰" title="PLATA" lvl={stats.lvlPlata} xp={stats.xpPlata} meta={plata.meta} progress={plata.porcentaje} color="bg-emerald-500" glow="shadow-emerald-500/20" />
          <StatCard emoji="🧠" title="PENSAR" lvl={stats.lvlPensar} xp={stats.xpPensar} meta={pensar.meta} progress={pensar.porcentaje} color="bg-blue-500" glow="shadow-blue-500/20" />
          <StatCard emoji="💪" title="FÍSICO" lvl={stats.lvlFisico} xp={stats.xpFisico} meta={fisico.meta} progress={fisico.porcentaje} color="bg-red-500" glow="shadow-red-500/20" />
          <StatCard emoji="❤️" title="SOCIAL" lvl={stats.lvlSocial} xp={stats.xpSocial} meta={social.meta} progress={social.porcentaje} color="bg-pink-500" glow="shadow-pink-500/20" />
        </div>

        {/* SECCIÓN: BITÁCORA DE LOGROS - Separada por margen superior */}
        <section className="border-t border-neutral-900 pt-10">
          <h3 className="text-neutral-500 text-xs font-bold tracking-[0.2em] mb-6 uppercase text-center">Bitácora de Logros</h3>
          <div className="space-y-3">
            {logros.length === 0 ? (
              <div className="text-neutral-700 text-sm text-center py-10 italic border border-dashed border-neutral-900 rounded-xl">
                Aún no hay logros registrados.<br/>¡Completá un ciclo para empezar!
              </div>
            ) : (
              logros.map((log) => (
                <div key={log.id} className="bg-neutral-900/30 border border-neutral-800/50 p-4 rounded-xl flex items-center justify-between group hover:bg-neutral-900 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">✓</div>
                    <span className="text-neutral-300 text-sm font-medium">{log.tarea}</span>
                  </div>
                  <span className="text-xs font-bold text-neutral-600 group-hover:text-white transition-colors bg-neutral-950 px-2 py-1 rounded">+{log.xpGanada} XP</span>
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </main>
  );
}

// Cards más altas (p-6) y con iconos más grandes
function StatCard({ emoji, title, lvl, xp, meta, progress, color, glow }: any) {
  return (
    <div className={`relative bg-neutral-900/60 backdrop-blur-md border border-neutral-800 p-6 rounded-3xl transition-all hover:border-neutral-700 group hover:translate-y-[-2px]`}>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <div className="text-3xl bg-neutral-950 w-14 h-14 flex items-center justify-center rounded-2xl border border-neutral-800 shadow-inner">{emoji}</div>
          <div>
            <h2 className="font-bold text-lg text-neutral-200 tracking-wide">{title}</h2>
            <p className="text-xs font-mono text-neutral-500 mt-0.5">NIVEL <span className="text-white font-bold">{lvl}</span></p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-neutral-400 mb-1 tracking-wider">PROGRESS</p>
          <p className="text-sm font-bold text-white font-mono">{xp}<span className="text-neutral-600">/{meta}</span></p>
        </div>
      </div>
      <div className="h-3 w-full bg-neutral-950 rounded-full overflow-hidden border border-neutral-800/50 p-0.5">
        <div className={`h-full ${color} rounded-full shadow-[0_0_20px_rgba(0,0,0,0.4)] ${glow} transition-all duration-1000 ease-out`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}