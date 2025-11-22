import Link from "next/link";

export function StatCard({ emoji, title, lvl, xp, meta, progress, color }: any) {
  // Protección contra undefined
  const safeTitle = title || "";
  const link = `/${safeTitle.toLowerCase()}`;

  return (
    <Link href={link} className="block">
      <div className="bg-[#111] border border-[#222] p-4 rounded-xl shadow-sm hover:border-[#444] hover:bg-[#151515] transition-all cursor-pointer group">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <div className="text-xl bg-[#1a1a1a] w-10 h-10 flex items-center justify-center rounded-lg border border-[#2a2a2a] group-hover:scale-110 transition-transform">{emoji}</div>
            <div>
              <h2 className="font-bold text-sm text-neutral-200 tracking-wide group-hover:text-white transition-colors">{title}</h2>
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
    </Link>
  );
}
