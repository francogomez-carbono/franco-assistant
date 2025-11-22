import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3000"; // Asegúrate de que tu server esté corriendo aquí
const TEST_TELEGRAM_ID = "999999999"; // Un ID falso para pruebas

async function main() {
  console.log("🤖 INICIANDO TEST E2E AUTOMATIZADO...");

  // --- PASO 0: LIMPIEZA ---
  console.log("\n🧹 1. Limpiando usuario de prueba...");
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: TEST_TELEGRAM_ID } });
    if (user) {
      await prisma.logCiclo.deleteMany({ where: { userId: user.id } });
      await prisma.logHabito.deleteMany({ where: { userId: user.id } });
      await prisma.userStats.delete({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    console.log("✅ Usuario limpio.");
  } catch (e) {
    console.log("ℹ️ Nada que limpiar o error menor.");
  }

  // --- PASO 1: SIMULAR MENSAJE DE TELEGRAM (Webhook) ---
  console.log("\n📨 2. Enviando mensaje simulado: 'Hice 10 flexiones'...");
  
  const payload = {
    update_id: 123456789,
    message: {
      message_id: 1,
      from: {
        id: parseInt(TEST_TELEGRAM_ID),
        is_bot: false,
        first_name: "Test",
        username: "TestUser"
      },
      chat: {
        id: parseInt(TEST_TELEGRAM_ID),
        type: "private"
      },
      date: Date.now() / 1000,
      text: "Hice 10 flexiones" // <--- EL MENSAJE CLAVE
    }
  };

  const response = await fetch(`${BASE_URL}/api/telegram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (response.status !== 200) {
    console.error("❌ Error: La API respondió", response.status);
    process.exit(1);
  }
  console.log("✅ API recibió el mensaje (Status 200).");

  // --- PASO 2: ESPERAR PROCESAMIENTO ---
  // La IA tarda un poco, damos 3 segundos de margen
  console.log("⏳ Esperando a que la IA procese...");
  await new Promise(r => setTimeout(r, 4000));

  // --- PASO 3: VERIFICAR BASE DE DATOS ---
  console.log("\n🕵️ 3. Verificando impacto en DB...");
  
  const user = await prisma.user.findUnique({
    where: { telegramId: TEST_TELEGRAM_ID },
    include: { stats: true, logsCiclo: true }
  });

  if (!user) {
    console.error("❌ FALLO: El usuario no se creó en la DB.");
    process.exit(1);
  }
  console.log("✅ Usuario creado/encontrado.");

  // Verificacion A: ¿Se guardó el log?
  const log = user.logsCiclo.find(l => l.tarea.toLowerCase().includes("flexiones") || l.tarea.toLowerCase().includes("entrenamiento"));
  if (!log) {
    console.error("❌ FALLO: No se encontró el LogCiclo de flexiones.");
    console.log("Logs encontrados:", user.logsCiclo);
    process.exit(1);
  }
  console.log(`✅ Log encontrado: "${log.tarea}" (+ ${log.xpGanada} XP)`);

  // Verificacion B: ¿Sumó XP en Stats?
  // 10 flexiones = 10 XP (según tu regla 1 rep = 1 xp)
  if (user.stats?.xpFisico && user.stats.xpFisico >= 10) {
    console.log(`✅ Stats actualizados: XP Físico es ${user.stats.xpFisico}`);
  } else {
    console.error(`❌ FALLO: La XP no se sumó correctamente. XP actual: ${user.stats?.xpFisico}`);
    process.exit(1);
  }

  console.log("\n🎉🎉 TEST PASADO EXITOSAMENTE 🎉🎉");
  console.log("El sistema recibe, piensa, guarda y premia correctamente.");
}

main();
