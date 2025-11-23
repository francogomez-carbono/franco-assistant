import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";

interface XPBarProps {
  level: number;
  currentXP: number;
  nextLevelXP: number; // Por defecto suele ser 100 o calculado
}

export function XPBar({ level, currentXP, nextLevelXP = 100 }: XPBarProps) {
  const progress = Math.min((currentXP / nextLevelXP) * 100, 100);

  return (
    <Card className="p-6 border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-xl font-bold text-emerald-500 border border-emerald-500/20">
          {level}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-zinc-400">EXPERIENCIA</span>
            <span className="text-zinc-500">{currentXP} / {nextLevelXP} XP</span>
          </div>
          <Progress value={progress} className="h-2 bg-zinc-800" indicatorClassName="bg-emerald-500" />
        </div>
      </div>
    </Card>
  );
}