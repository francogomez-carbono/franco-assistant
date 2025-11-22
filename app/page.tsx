import { PrismaClient } from "@prisma/client";

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

async function getData() {
  // 1. Stats
  const stats = await prisma.userStats.findFirst() || { 
    xpPlata: 0, lvlPlata: 1, xpPensar: 0, lvlPensar: 1, 
    xpFisico: 0, lvlFisico: 1, xpSocial: 0, lvlSocial: 1 
  };

  // 2. Últimos Logros (Ciclos Completados) - LA BITÁCORA QUE TE GUSTA
  const logros = await prisma.logCiclo.findMany({
    where: { estado: 'COMPLETADO' },
    take: 7, // Muestro un par más ya que sacamos las ideas
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
    <main className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-purple-500/30 pb-20">
      <div className="max-w-md mx-auto min-h-screen flex flex-col p-6">
        
        {/* HEADER */}
        <header className="mb-8 text-center space-y-4 pt-6">
          <div className="relative inline-block">
            <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              LIFE OS
            </h1>
            <span className="absolute -top-3 -right-6 bg-neutral-800 text-[10px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-400">BETA</span>
          </div>
          
          <div className="flex justify-center gap-3 text-xs font-mono text-neutral-400">
            <div className="bg-neutral-900/80 px-3 py-1.5 rounded border border-neutral-800">
              PLAYER: <span className="text-white font-bold">FRANCO</span>
            </div>
            <div className="bg-neutral-900/80 px-3 py-1.5 rounded border border-neutral-800">
              LVL: <span className="text-yellow-400 font-bold text-base">{global.nivel}</span>
            </div>
          </div>

          {/* BARRA GLOBAL */}
          <div className="px-2 mt-2">
             <div className="flex justify-between text-[10px] text-neutral-600 font-mono mb-1">
                <span>XP: {totalXP}</span>
                <span>NEXT: {global.xpRestante}/{global.proximoNivel}</span>
             </div>
             <div className="h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400/80 shadow-[0_0_10px_rgba(250,204,21,0.5)] transition-all duration-1000"
                  style={{ width: `${(global.xpRestante / global.proximoNivel) * 100}%` }} />
             </div>
          </div>
        </header>

        {/* STATS GRID */}
        <div className="space-y-4 mb-10">
          <StatCard emoji="💰" title="PLATA" lvl={stats.lvlPlata} xp={stats.xpPlata} meta={plata.meta} progress={plata.porcentaje} color="bg-emerald-500" glow="shadow-emerald-500/20" />
          <StatCard emoji="🧠" title="PENSAR" lvl={stats.lvlPensar} xp={stats.xpPensar} meta={pensar.meta} progress={pensar.porcentaje} color="bg-blue-500" glow="shadow-blue-500/20" />
          <StatCard emoji="💪" title="FÍSICO" lvl={stats.lvlFisico} xp={stats.xpFisico} meta={fisico.meta} progress={fisico.porcentaje} color="bg-red-500" glow="shadow-red-500/20" />
          <StatCard emoji="❤️" title="SOCIAL" lvl={stats.lvlSocial} xp={stats.xpSocial} meta={social.meta} progress={social.porcentaje} color="bg-pink-500" glow="shadow-pink-500/20" />
        </div>

        {/* SECCIÓN: BITÁCORA DE LOGROS */}
        <section>
          <h3 className="text-neutral-500 text-xs font-bold tracking-widest mb-4 uppercase">Bitácora Reciente (Logros)</h3>
          <div className="space-y-2">
            {logros.length === 0 ? (
              <div className="text-neutral-600 text-sm text-center py-4 italic">Aún no completaste ciclos.</div>
            ) : (
              logros.map((log) => (
                <div key={log.id} className="flex items-center justify-between text-sm border-b border-neutral-900 pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-neutral-300">{log.tarea}</span>
                  </div>
                  <span className="text-xs font-mono text-neutral-500">+{log.xpGanada} XP</span>
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </main>
  );
}

function StatCard({ emoji, title, lvl, xp, meta, progress, color, glow }: any) {
  return (
    <div className={`relative bg-neutral-900/80 backdrop-blur border border-neutral-800 p-4 rounded-xl transition-all hover:border-neutral-700 group`}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <div className="text-2xl bg-neutral-800 w-10 h-10 flex items-center justify-center rounded-lg">{emoji}</div>
          <div>
            <h2 className="font-bold text-sm text-neutral-200 tracking-wide">{title}</h2>
            <p className="text-[10px] font-mono text-neutral-500">LVL <span className="text-white">{lvl}</span></p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-white">{xp} <span className="text-neutral-600 font-normal">/ {meta}</span></p>
        </div>
      </div>
      <div className="h-2 w-full bg-neutral-950 rounded-full overflow-hidden border border-neutral-800/50">
        <div className={`h-full ${color} rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] ${glow} transition-all duration-1000 ease-out`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}