import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
// Tu ID de Telegram (lo saqué de tus capturas anteriores)
const MY_TELEGRAM_ID = "5002389519"; 

const REAL_QUESTS = [
  // --- FÍSICO ---
  { title: "Entrenar (Gym/Box)", xp: 50, pilar: "FISICO" },
  { title: "Comer limpio (No procesados)", xp: 30, pilar: "FISICO" },
  { title: "Creatina + Agua (3L)", xp: 20, pilar: "FISICO" },
  
  // --- PLATA ---
  { title: "Registrar gastos del día", xp: 20, pilar: "PLATA" },
  { title: "Revisar acciones/crypto", xp: 15, pilar: "PLATA" },
  { title: "0 Gastos hormiga", xp: 50, pilar: "PLATA" },
  
  // --- PENSAR ---
  { title: "Leer 20 min", xp: 30, pilar: "PENSAR" },
  { title: "Codeo profundo (2h)", xp: 100, pilar: "PENSAR" },
  { title: "Ver clase/tutorial", xp: 40, pilar: "PENSAR" },
  
  // --- SOCIAL ---
  { title: "Mensaje a familia/amigos", xp: 25, pilar: "SOCIAL" },
  { title: "Salida o llamada de calidad", xp: 60, pilar: "SOCIAL" },
];

async function main() {
  console.log("🌱 Configurando tus misiones reales...");

  const user = await prisma.user.findUnique({
    where: { telegramId: MY_TELEGRAM_ID } 
  });

  if (!user) {
    console.error("❌ No encontré tu usuario. Asegúrate de haber hablado con el bot al menos una vez.");
    return;
  }

  // 1. BORRAR LAS ANTERIORES (Limpieza)
  console.log("🧹 Borrando misiones viejas...");
  await prisma.questPreset.deleteMany({ where: { userId: user.id } });

  // 2. CREAR LAS REALES
  console.log("🚀 Insertando misiones nuevas...");
  for (const q of REAL_QUESTS) {
    await prisma.questPreset.create({
      data: {
        title: q.title,
        xp: q.xp,
        pilar: q.pilar as any,
        userId: user.id
      }
    });
  }

  console.log(`✅ ¡Listo! ${REAL_QUESTS.length} misiones activas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
