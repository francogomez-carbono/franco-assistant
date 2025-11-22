import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ActivityFeed({ logs }: { logs: any[] }) {
  return (
    <Card className="border-neutral-800 bg-neutral-900/50 text-neutral-100">
      <CardHeader>
        <CardTitle className="text-sm text-neutral-400">Últimos Ciclos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {logs.slice(0, 5).map((log) => (
          <div key={log.id} className="flex justify-between items-center border-b border-neutral-800 pb-2 last:border-0">
            <div className="text-sm">
              <div className="font-medium">{log.tarea}</div>
              <div className="text-xs text-neutral-500">
                {new Date(log.inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <Badge variant="secondary" className="bg-neutral-800 text-neutral-300 text-xs">
              +{log.xpGanada} XP
            </Badge>
          </div>
        ))}
        {logs.length === 0 && <p className="text-xs text-neutral-600">Sin datos.</p>}
      </CardContent>
    </Card>
  );
}
