import { PrismaClient } from "@prisma/client";

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

async function getStats() {
  const stats = await prisma.userStats.findFirst();
  return stats || { 
    xpPlata: 0, lvlPlata: 1, 
    xpPensar: 0, lvlPensar: 1, 
    xpFisico: 0, lvlFisico: 1, 
    xpSocial: 0, lvlSocial: 1 
  };
}

// FUNCIÓN CALCULADORA DE NIVEL (Algoritmo Gamer)
function calcularNivelGlobal(totalXP: number) {
  let nivel = 1;
  let costoProximo = 100; // Costo para pasar de lvl 1 a 2

  // Mientras nos alcance la XP para pagar el siguiente nivel...
  while (totalXP >= costoProximo) {
    totalXP -= costoProximo; // "Pagamos" el nivel
    nivel++;                 // Subimos
    costoProximo = nivel * 100; // El siguiente cuesta más
  }
  
  return { nivel, xpRestante: totalXP, proximoNivel: costoProximo };
}

export default async function Home() {
  const stats = await getStats();
  
  // Función auxiliar para barras individuales
  const getProgress = (xp: number, lvl: number) => {
    const meta = lvl * 100;
    const porcentaje = Math.min(100, Math.round((xp / meta) * 100));
    return { porcentaje, meta };
  };

  const plata = getProgress(stats.xpPlata, stats.lvlPlata);
  const pensar = getProgress(stats.xpPensar, stats.lvlPensar);
  const fisico = getProgress(stats.xpFisico, stats.lvlFisico);
  const social = getProgress(stats.xpSocial, stats.lvlSocial);
  
  // --- CORRECCIÓN AQUÍ ---
  const totalXP = stats.xpPlata + stats.xpPensar + stats.xpFisico + stats.xpSocial;
  const global = calcularNivelGlobal(totalXP);
  // -----------------------

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-purple-500/30">
      <div className="max-w-md mx-auto min-h-screen flex flex-col p-6">
        
        {/* HEADER */}
        <header className="mb-10 text-center space-y-4 pt-10">
          <div className="relative inline-block">
            <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              LIFE OS
            </h1>
            <span className="absolute -top-3 -right-6 bg-neutral-800 text-xs px-2 py-0.5 rounded border border-neutral-700 text-neutral-400">BETA</span>
          </div>
          
          <div className="flex justify-center gap-4 text-sm font-mono text-neutral-400">
            <div className="bg-neutral-900/50 px-4 py-2 rounded-lg border border-neutral-800">
              PLAYER: <span className="text-white font-bold">FRANCO</span>
            </div>
            <div className="bg-neutral-900/50 px-4 py-2 rounded-lg border border-neutral-800">
              {/* AHORA MUESTRA EL NIVEL GLOBAL CALCULADO */}
              LVL CUENTA: <span className="text-yellow-400 font-bold text-lg">{global.nivel}</span>
            </div>
          </div>

          {/* NUEVO: BARRA DE PROGRESO DE CUENTA */}
          <div className="px-4">
             <div className="flex justify-between text-[10px] text-neutral-500 font-mono mb-1">
                <span>XP GLOBAL: {totalXP}</span>
                <span>NEXT LVL: {global.xpRestante} / {global.proximoNivel}</span>
             </div>
             <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-400/80 shadow-[0_0_10px_rgba(250,204,21,0.5)] transition-all duration-1000"
                  style={{ width: `${(global.xpRestante / global.proximoNivel) * 100}%` }}
                />
             </div>
          </div>
        </header>

        {/* STATS GRID */}
        <div className="space-y-6 flex-1">
          <StatCard 
            emoji="💰" title="PLATA" lvl={stats.lvlPlata} xp={stats.xpPlata} meta={plata.meta} progress={plata.porcentaje} color="bg-emerald-500" glow="shadow-emerald-500/20"
          />
          <StatCard 
            emoji="🧠" title="PENSAR" lvl={stats.lvlPensar} xp={stats.xpPensar} meta={pensar.meta} progress={pensar.porcentaje} color="bg-blue-500" glow="shadow-blue-500/20"
          />
          <StatCard 
            emoji="💪" title="FÍSICO" lvl={stats.lvlFisico} xp={stats.xpFisico} meta={fisico.meta} progress={fisico.porcentaje} color="bg-red-500" glow="shadow-red-500/20"
          />
          <StatCard 
            emoji="❤️" title="SOCIAL" lvl={stats.lvlSocial} xp={stats.xpSocial} meta={social.meta} progress={social.porcentaje} color="bg-pink-500" glow="shadow-pink-500/20"
          />
        </div>

        <footer className="mt-12 text-center text-xs text-neutral-700 font-mono pb-6">
          <p>SYNCED WITH TELEGRAM • POWERED BY GPT-4</p>
        </footer>
      </div>
    </main>
  );
}

function StatCard({ emoji, title, lvl, xp, meta, progress, color, glow }: any) {
  return (
    <div className={`relative bg-neutral-900/80 backdrop-blur border border-neutral-800 p-5 rounded-2xl transition-all hover:border-neutral-700 hover:bg-neutral-900 group`}>
      <div className="flex justify-between items-end mb-3">
        <div className="flex items-center gap-4">
          <div className="text-3xl bg-neutral-800 w-12 h-12 flex items-center justify-center rounded-xl">{emoji}</div>
          <div>
            <h2 className="font-bold text-neutral-200 tracking-wide">{title}</h2>
            <p className="text-xs font-mono text-neutral-500">NIVEL <span className="text-white text-sm">{lvl}</span></p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-mono text-neutral-500 mb-1">XP</p>
          <p className="text-sm font-bold text-white">{xp} <span className="text-neutral-600 font-normal">/ {meta}</span></p>
        </div>
      </div>
      <div className="h-4 w-full bg-neutral-950 rounded-full overflow-hidden border border-neutral-800/50 p-0.5">
        <div className={`h-full ${color} rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] ${glow} transition-all duration-1000 ease-out`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}