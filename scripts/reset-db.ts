import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔥 Iniciando Protocolo de Reseteo...");

  try {
    // 1. Borrar todos los Logs (Historial)
    console.log("🧹 Barriendo logs de actividad...");
    await prisma.logCiclo.deleteMany();
    await prisma.logHabito.deleteMany();
    await prisma.logConsumo.deleteMany();
    await prisma.logEstado.deleteMany();
    await prisma.logSocial.deleteMany();
    await prisma.logIdea.deleteMany();
    
    // Si tienes la tabla Addiction descomenta esto:
    // await prisma.addiction.deleteMany();

    // 2. Resetear Stats a Nivel 1 / 0 XP
    console.log("🔄 Reajustando niveles a base...");
    await prisma.userStats.updateMany({
      data: {
        // Físico
        xpFisico: 0, lvlFisico: 1, rachaFisico: 0,
        
        // Plata
        xpPlata: 0, lvlPlata: 1, rachaPlata: 0,
        
        // Pensar
        xpPensar: 0, lvlPensar: 1, rachaPensar: 0,
        
        // Social
        xpSocial: 0, lvlSocial: 1, rachaSocial: 0,
      }
    });

    console.log("✨ ¡LISTO! Tu vida ha comenzado de nuevo (Nivel 1).");
    
  } catch (error) {
    console.error("❌ Error durante el reseteo:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
