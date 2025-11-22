import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar, MobileNav } from "@/components/layout/sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Franco Assistant",
  description: "Dashboard de Alto Rendimiento",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark h-full">
      <body className={`${inter.className} h-full overflow-hidden bg-neutral-950`}>
        <div className="flex h-full">
          {/* Sidebar Desktop (Fijo) */}
          <Sidebar />
          
          {/* Contenedor Principal (Scrollable) */}
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header Mobile */}
            <header className="md:hidden border-b border-neutral-800 p-4 flex items-center justify-between bg-neutral-950 flex-shrink-0">
               <span className="font-bold text-white">Franco Assistant</span>
               <MobileNav />
            </header>

            {/* Área de Scroll */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="max-w-[1600px]">
                {children}
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
