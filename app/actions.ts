"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

// --- HELPER: SANITIZAR NOMBRES ---
function getXpFieldName(pilar: string) {
  const cleanPilar = pilar.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return `xp${cleanPilar.charAt(0).toUpperCase() + cleanPilar.slice(1).toLowerCase()}`;
}

function getLvlFieldName(pilar: string) {
  const cleanPilar = pilar.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return `lvl${cleanPilar.charAt(0).toUpperCase() + cleanPilar.slice(1).toLowerCase()}`;
}

// --- MOTOR DE XP (SUBIDA Y BAJADA) ---
async function updateXP(userId: string, pilar: string, amount: number) {
  const xpField = getXpFieldName(pilar);
  const lvlField = getLvlFieldName(pilar);

  // 1. Obtener estado actual
  const stats: any = await prisma.userStats.findUnique({ where: { userId } });
  if (!stats) return;

  let currentXP = stats[xpField] + amount; // Aplicamos el cambio (+ o -)
  let currentLvl = stats[lvlField];

  // 2. Lógica de LEVEL UP (Subir)
  // Mientras la XP supere el tope del nivel actual (Nivel * 100)
  let maxXP = currentLvl * 100;
  while (currentXP >= maxXP) {
    currentXP -= maxXP; // Restamos el coste del nivel
    currentLvl++;       // Subimos de nivel
    maxXP = currentLvl * 100; // Nuevo tope para el siguiente
  }

  // 3. Lógica de LEVEL DOWN (Bajar)
  // Mientras la XP sea negativa
  while (currentXP < 0) {
    if (currentLvl > 1) {
      currentLvl--;       // Bajamos de nivel
      maxXP = currentLvl * 100; // Tope del nivel anterior
      currentXP += maxXP; // La deuda se paga con la XP del nivel anterior
    } else {
      // Si ya es Nivel 1 y sigue negativo, lo dejamos en 0 (Game Over técnico)
      currentXP = 0;
      break;
    }
  }

  // 4. Guardar el nuevo estado limpio
  await prisma.userStats.update({
    where: { userId },
    data: {
      [xpField]: currentXP,
      [lvlField]: currentLvl
    }
  });

  revalidatePath("/", "layout");
}

// --- ACCIÓN 1: BORRAR ACTIVIDAD ---
export async function deleteActivity(logId: string, xp: number, pilar: string, userId: string) {
  try {
    await prisma.logCiclo.delete({ where: { id: logId } });
    // Restamos XP (amount negativo)
    await updateXP(userId, pilar, -xp);
  } catch (error) {
    console.error("Error borrando actividad:", error);
  }
}

// --- ACCIÓN 2: TOGGLE MISIÓN DIARIA ---
export async function toggleQuest(title: string, xp: number, pilar: string, userId: string, isCompleted: boolean) {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  try {
    if (!isCompleted) {
      // MARCAR COMO HECHO -> Crear log y Sumar XP
      await prisma.logHabito.create({
        data: {
          userId,
          nombre: title,
          estado: "HECHO",
          xpGanada: xp,
          timestamp: new Date()
        }
      });
      await updateXP(userId, pilar, xp);

    } else {
      // DESMARCAR -> Borrar log y Restar XP
      const log = await prisma.logHabito.findFirst({
        where: {
          userId,
          nombre: title,
          timestamp: { gte: startOfDay, lte: endOfDay }
        }
      });

      if (log) {
        await prisma.logHabito.delete({ where: { id: log.id } });
        await updateXP(userId, pilar, -xp);
      }
    }
  } catch (error) {
    console.error("Error toggleando misión:", error);
  }
}

// --- ACCIÓN 3: REGISTRAR RECAÍDA (Resetear Contador) ---
export async function reportRelapse(userId: string, motivo: string = "General") {
  try {
    // 1. Guardar el log de la caída (para saber cuándo fue)
    await prisma.dopamineLog.create({
      data: {
        userId,
        motivo,
        fecha: new Date()
      }
    });

    // 2. Castigo de XP (Opcional: Restar 100 XP por caer)
    // await updateXP(userId, "FISICO", -100); 

    revalidatePath("/", "layout");
  } catch (error) {
    console.error("Error reportando recaída:", error);
  }
}

// 1. Crear nuevo tracker (Ej: "Azúcar")
export async function createAddiction(name: string, userId: string) {
  if (!name) return;
  await prisma.addiction.create({
    data: {
      nombre: name,
      userId,
      inicio: new Date(),
      ultimoRelapso: new Date(), // Empieza en 0
    }
  });
  revalidatePath("/", "layout");
}

// 2. Recaer en uno específico
export async function relapseAddiction(id: string, userId: string) {
  const addiction = await prisma.addiction.findUnique({ where: { id } });
  if (!addiction) return;

  const now = new Date();
  const diffTime = Math.abs(now.getTime() - addiction.ultimoRelapso.getTime());
  const hoursClean = diffTime / (1000 * 60 * 60);

  // Guardamos el récord si fue el mejor intento
  const newRecord = Math.max(addiction.recordHoras, hoursClean);

  await prisma.addiction.update({
    where: { id },
    data: {
      ultimoRelapso: now,
      recaidas: { increment: 1 },
      recordHoras: newRecord
    }
  });
  
  // Opcional: Guardar en el log histórico también
  await prisma.dopamineLog.create({
    data: { userId, fecha: now, motivo: addiction.nombre }
  });

  revalidatePath("/", "layout");
}

// 3. Borrar tracker
export async function deleteAddiction(id: string) {
  await prisma.addiction.delete({ where: { id } });
  revalidatePath("/", "layout");
}