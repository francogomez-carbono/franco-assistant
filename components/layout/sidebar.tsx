"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Brain, Zap, Heart, DollarSign, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const menuItems = [
  { name: "General", href: "/", icon: LayoutDashboard, color: "text-neutral-400" },
  { name: "Plata", href: "/plata", icon: DollarSign, color: "text-emerald-500" },
  { name: "Pensar", href: "/pensar", icon: Brain, color: "text-blue-500" },
  { name: "Físico", href: "/fisico", icon: Zap, color: "text-orange-500" },
  { name: "Social", href: "/social", icon: Heart, color: "text-rose-500" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col border-r border-neutral-800 bg-neutral-950 w-72 hidden md:flex">
      <div className="p-8">
        {/* CAMBIO: Solo dice "Assistant" */}
        <h2 className="text-3xl font-bold tracking-tight text-white">Assistant</h2>
      </div>
      <nav className="flex-1 space-y-2 px-6">
        {menuItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center gap-4 rounded-xl px-4 py-3.5 text-base font-medium transition-all duration-200",
              pathname === item.href 
                ? "bg-neutral-900 text-white border border-neutral-800 shadow-sm" 
                : "text-neutral-400 hover:bg-neutral-900/50 hover:text-white"
            )}
          >
            <item.icon className={cn("h-6 w-6", item.color)} />
            {item.name}
          </Link>
        ))}
      </nav>
      <div className="p-6 border-t border-neutral-800">
        <div className="flex items-center gap-4 p-2 rounded-xl hover:bg-neutral-900/50 cursor-pointer transition-colors">
           <div className="h-10 w-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center shadow-inner">
              <span className="text-sm font-bold text-white">FG</span>
           </div>
           <div className="flex flex-col">
              <p className="text-sm font-bold text-white leading-none">Franco Gomez</p>
              <p className="text-xs text-neutral-500 mt-1">Admin</p>
           </div>
        </div>
      </div>
    </div>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden text-white hover:bg-neutral-800">
          <Menu className="h-7 w-7" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-neutral-950 border-neutral-800 text-white p-0 w-72">
        <div className="p-8">
          <h2 className="text-2xl font-bold tracking-tight">Assistant</h2>
        </div>
        <nav className="flex-1 space-y-2 px-6 mt-2">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-4 rounded-xl px-4 py-3 text-base font-medium transition-colors",
                pathname === item.href 
                  ? "bg-neutral-900 text-white border border-neutral-800" 
                  : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
              )}
            >
              <item.icon className={cn("h-5 w-5", item.color)} />
              {item.name}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
