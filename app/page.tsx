import { PrismaClient } from "@prisma/client";

// Forzamos a que la página se actualice siempre (No caché)
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

async function getStats() {
  // Buscamos tus stats. Si no existen (usuario nuevo), devolvemos todo en 0.
  const stats = await prisma.userStats.findFirst();
  return stats || { 
    xpPlata: 0, lvlPlata: 1, 
    xpPensar: 0, lvlPensar: 1, 
    xpFisico: 0, lvlFisico: 1, 
    xpSocial: 0, lvlSocial: 1 
  };
}

export default async function Home() {
  const stats = await getStats();
  
  // Función para calcular % de barra
  // Regla: Para subir de nivel X, necesitás X * 100 XP.
  const getProgress = (xp: number, lvl: number) => {
    const meta = lvl * 100;
    const porcentaje = Math.min(100, Math.round((xp / meta) * 100));
    return { porcentaje, meta };
  };

  const plata = getProgress(stats.xpPlata, stats.lvlPlata);
  const pensar = getProgress(stats.xpPensar, stats.lvlPensar);
  const fisico = getProgress(stats.xpFisico, stats.lvlFisico);
  const social = getProgress(stats.xpSocial, stats.lvlSocial);
  
  const nivelTotal = stats.lvlPlata + stats.lvlPensar + stats.lvlFisico + stats.lvlSocial;

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
              LVL TOTAL: <span className="text-yellow-400 font-bold">{nivelTotal}</span>
            </div>
          </div>
        </header>

        {/* STATS GRID */}
        <div className="space-y-6 flex-1">
          
          <StatCard 
            emoji="💰" 
            title="PLATA" 
            lvl={stats.lvlPlata} 
            xp={stats.xpPlata} 
            meta={plata.meta} 
            progress={plata.porcentaje} 
            color="bg-emerald-500" 
            glow="shadow-emerald-500/20"
          />

          <StatCard 
            emoji="🧠" 
            title="PENSAR" 
            lvl={stats.lvlPensar} 
            xp={stats.xpPensar} 
            meta={pensar.meta} 
            progress={pensar.porcentaje} 
            color="bg-blue-500" 
            glow="shadow-blue-500/20"
          />

          <StatCard 
            emoji="💪" 
            title="FÍSICO" 
            lvl={stats.lvlFisico} 
            xp={stats.xpFisico} 
            meta={fisico.meta} 
            progress={fisico.porcentaje} 
            color="bg-red-500" 
            glow="shadow-red-500/20"
          />

          <StatCard 
            emoji="❤️" 
            title="SOCIAL" 
            lvl={stats.lvlSocial} 
            xp={stats.xpSocial} 
            meta={social.meta} 
            progress={social.porcentaje} 
            color="bg-pink-500" 
            glow="shadow-pink-500/20"
          />

        </div>

        {/* FOOTER */}
        <footer className="mt-12 text-center text-xs text-neutral-700 font-mono pb-6">
          <p>SYNCED WITH TELEGRAM • POWERED BY GPT-4</p>
        </footer>
      </div>
    </main>
  );
}

// Componente visual de la tarjeta
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
          <p className="text-sm font-bold text-white">
            {xp} <span className="text-neutral-600 font-normal">/ {meta}</span>
          </p>
        </div>
      </div>
      
      {/* BARRA DE PROGRESO */}
      <div className="h-4 w-full bg-neutral-950 rounded-full overflow-hidden border border-neutral-800/50 p-0.5">
        <div 
          className={`h-full ${color} rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] ${glow} transition-all duration-1000 ease-out`} 
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Etiqueta de % flotante */}
      <div className="absolute top-5 right-5 text-[10px] font-mono text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity">
        {progress}%
      </div>
    </div>
  );
}