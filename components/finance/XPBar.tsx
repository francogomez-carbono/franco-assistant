import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";

interface XPBarProps {
  level: number;
  currentXP: number;
  nextLevelXP: number;
}

export function XPBar({ level, currentXP, nextLevelXP }: XPBarProps) {
  const progress = Math.min((currentXP / nextLevelXP) * 100, 100);

  return (
    // CAMBIO: py-4 en lugar de p-6 para reducir altura
    <Card className="px-6 py-4 border-zinc-800 bg-zinc-950 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-lg font-bold text-emerald-500 border border-emerald-500/20">
          {level}
        </div>
        <div className="flex-1">
          <div className="flex justify-between text-xs mb-2">
            <span className="font-medium text-zinc-400 tracking-wider uppercase">Experiencia</span>
            <span className="text-zinc-500">{currentXP} / {nextLevelXP} XP</span>
          </div>
          <Progress value={progress} className="h-2 bg-zinc-900" indicatorClassName="bg-emerald-500" />
        </div>
      </div>
    </Card>
  );
}