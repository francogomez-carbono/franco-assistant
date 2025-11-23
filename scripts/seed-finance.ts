import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
// Tu ID de Telegram (Asegurate que sea el correcto)
const MY_TELEGRAM_ID = "5002389519"; 

async function main() {
  console.log("💰 Sembrando transacciones financieras...");

  const user = await prisma.user.findUnique({
    where: { telegramId: MY_TELEGRAM_ID } 
  });

  if (!user) {
    console.error("❌ Usuario no encontrado.");
    return;
  }

  // Limpiar anteriores
  await prisma.financialTransaction.deleteMany({ where: { userId: user.id } });

  const transactions = [
    // INGRESOS
    { amount: 1500000, type: "INGRESO", category: "Sueldo", desc: "Nómina Mensual", daysAgo: 15 },
    { amount: 50000, type: "INGRESO", category: "Freelance", desc: "Trabajo extra", daysAgo: 5 },
    
    // GASTOS (Comida)
    { amount: 12000, type: "GASTO", category: "Comida", desc: "Almuerzo trabajo", daysAgo: 1 },
    { amount: 45000, type: "GASTO", category: "Comida", desc: "Supermercado", daysAgo: 3 },
    { amount: 8500, type: "GASTO", category: "Comida", desc: "Café", daysAgo: 0 },
    
    // GASTOS (Transporte)
    { amount: 6000, type: "GASTO", category: "Transporte", desc: "Uber", daysAgo: 2 },
    { amount: 400, type: "GASTO", category: "Transporte", desc: "Subte", daysAgo: 4 },
    
    // GASTOS (Servicios)
    { amount: 25000, type: "GASTO", category: "Servicios", desc: "Internet", daysAgo: 10 },
    { amount: 15000, type: "GASTO", category: "Suscripciones", desc: "Netflix/Spotify", daysAgo: 12 },
  ];

  for (const tx of transactions) {
    const date = new Date();
    date.setDate(date.getDate() - tx.daysAgo);
    
    await prisma.financialTransaction.create({
      data: {
        userId: user.id,
        amount: tx.amount,
        type: tx.type as any,
        category: tx.category,
        description: tx.desc,
        timestamp: date
      }
    });
  }

  console.log(`✅ Creados ${transactions.length} movimientos.`);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
