import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, DollarSign, Heart, Zap } from "lucide-react";

interface StatsProps {
  stats: {
    lvlPlata: number; xpPlata: number;
    lvlPensar: number; xpPensar: number;
    lvlFisico: number; xpFisico: number;
    lvlSocial: number; xpSocial: number;
  }
}

export function StatsGrid({ stats }: StatsProps) {
  // Calculamos el progreso
  const getProgress = (xp: number, lvl: number) => Math.min(100, (xp / (lvl * 100)) * 100);
  
  // Formato de texto: "60 / 100 XP"
  const getText = (xp: number, lvl: number) => `${xp} / ${lvl * 100} XP`;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
      <KpiCard title="Plata" icon={<DollarSign className="h-4 w-4 text-emerald-400" />} value={"Lvl " + stats.lvlPlata} subtext={getText(stats.xpPlata, stats.lvlPlata)} progress={getProgress(stats.xpPlata, stats.lvlPlata)} color="bg-emerald-500" />
      <KpiCard title="Pensar" icon={<Brain className="h-4 w-4 text-blue-400" />} value={"Lvl " + stats.lvlPensar} subtext={getText(stats.xpPensar, stats.lvlPensar)} progress={getProgress(stats.xpPensar, stats.lvlPensar)} color="bg-blue-500" />
      <KpiCard title="Físico" icon={<Zap className="h-4 w-4 text-orange-400" />} value={"Lvl " + stats.lvlFisico} subtext={getText(stats.xpFisico, stats.lvlFisico)} progress={getProgress(stats.xpFisico, stats.lvlFisico)} color="bg-orange-500" />
      <KpiCard title="Social" icon={<Heart className="h-4 w-4 text-rose-400" />} value={"Lvl " + stats.lvlSocial} subtext={getText(stats.xpSocial, stats.lvlSocial)} progress={getProgress(stats.xpSocial, stats.lvlSocial)} color="bg-rose-500" />
    </div>
  );
}

function KpiCard({ title, icon, value, subtext, progress, color }: any) {
  return (
    <Card className="border-neutral-800 bg-neutral-900/50 text-neutral-100">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-neutral-400">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-neutral-500 mb-2">{subtext}</p>
        <div className="h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
          <div className={`h-full ${color}`} style={{ width: `${progress}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}
