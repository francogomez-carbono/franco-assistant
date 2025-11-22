import { Badge } from "@/components/ui/badge";

export function DashboardHeader() {
  return (
    <header className="mb-8 flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-100">Franco Assistant</h1>
        <p className="text-neutral-400">Dashboard de Alto Rendimiento</p>
      </div>
      <Badge variant="outline" className="border-green-900 text-green-400 bg-green-900/10 px-3 py-1">
        Sistema Operativo 🟢
      </Badge>
    </header>
  );
}
