import { Bot, webhookCallback } from "grammy";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const prisma = new PrismaClient();
const token = process.env.TELEGRAM_TOKEN;
const bot = token ? new Bot(token) : null;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- HELPERS ---
function getXpFieldName(pilar: string) {
  const cleanPilar = pilar.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return `xp${cleanPilar.charAt(0).toUpperCase() + cleanPilar.slice(1).toLowerCase()}`;
}

function getLvlFieldName(pilar: string) {
  const cleanPilar = pilar.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return `lvl${cleanPilar.charAt(0).toUpperCase() + cleanPilar.slice(1).toLowerCase()}`;
}

async function checkLevelUp(userId: string, pilar: string) {
  const xpField = getXpFieldName(pilar);
  const lvlField = getLvlFieldName(pilar);
  const stats: any = await prisma.userStats.findUnique({ where: { userId } });
  if (!stats) return "";

  let currentXP = stats[xpField];
  let currentLvl = stats[lvlField];
  let xpToNextLevel = currentLvl * 100;
  let leveledUp = false;

  while (currentXP >= xpToNextLevel) {
    currentXP -= xpToNextLevel;
    currentLvl++;
    xpToNextLevel = currentLvl * 100;
    leveledUp = true;
  }

  if (leveledUp) {
    await prisma.userStats.update({
      where: { userId },
      data: { [xpField]: currentXP, [lvlField]: currentLvl }
    });
    return `\n🎉 **¡LEVEL UP!** Nivel ${currentLvl} en ${pilar}.`;
  }
  return "";
}

async function getUser(ctx: any) {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return null;
  let user = await prisma.user.findUnique({ where: { telegramId }, include: { stats: true } });
  if (!user) {
    user = await prisma.user.create({ data: { telegramId, stats: { create: {} } }, include: { stats: true } });
  }
  return user;
}

// --- PROMPT MEJORADO ---
const SYSTEM_PROMPT_LOGGER = `
Rol: Asistente de base de datos personal.
Tarea: Convertir lenguaje natural a JSON estricto.

REGLAS IMPORTANTES:
1. FINANZAS: Si hay dinero involucrado (gasto, ingreso, pago, compra, precio), SIEMPRE usa type="finanzas".
2. PENSAR: Lectura, estudio, trabajo profundo.
3. FISICO: Entrenar, comer, dormir.
4. SOCIAL: Salidas, familia, amigos.

JSON (Strict):
{
  "events": [
    {
      "type": "estado"|"finanzas"|"ciclo_inicio"|"ciclo_fin"|"ejercicio_reps"|"consumo"|"nota"|"social",
      "reply": "Texto corto confirmando la acción",
      "pilar": "PLATA"|"PENSAR"|"FISICO"|"SOCIAL",
      
      // Campos opcionales según tipo
      "monto": number,
      "tipo_financiero": "GASTO" | "INGRESO",
      "categoria": "txt",
      "descripcion": "txt",
      "cantidad": number,
      "reps": number
    }
  ]
}
`;

const handleMessage = async (ctx: any) => {
  if (!ctx.message?.text) return;

  // MODO TEST
  if (ctx.chat.id === 999999999) {
    ctx.reply = async (text: string) => { console.log(`[TEST] Bot: ${text}`); };
  }
  
  const user = await getUser(ctx);
  if (!user) return;
  
  const userId = user.id;
  const text = ctx.message.text;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT_LOGGER }, { role: "user", content: text }],
      temperature: 0.1, // Bajamos temperatura para que sea más estricto
      max_tokens: 400, 
      response_format: { type: "json_object" }
    });

    const raw = completion.choices[0].message.content || "{}";
    console.log("🧠 IA Response:", raw); // <--- DEBUG: VER ESTO EN CONSOLA SI FALLA
    const data = JSON.parse(raw);
    const eventos = data.events || [data]; 
    let respuestasArray: string[] = [];

    for (const evento of eventos) {
      let xpGanada = 0;
      let pilarXP = evento.pilar || "FISICO"; 
      let notaExtra = "";

      // --- FORZAR TIPO SI HAY MONTO ---
      if (evento.monto && evento.type !== "finanzas") {
        evento.type = "finanzas";
        pilarXP = "PLATA";
      }

      switch (evento.type) {
        case "finanzas":
          xpGanada = 10; 
          pilarXP = "PLATA"; // Aseguramos el pilar
          await prisma.financialTransaction.create({
            data: {
              userId,
              amount: evento.monto || 0,
              type: evento.tipo_financiero || "GASTO",
              category: evento.categoria || "Varios",
              description: evento.descripcion || text
            }
          });
          break;

        case "ejercicio_reps":
          if (evento.reps) { 
            xpGanada = evento.reps; 
            pilarXP = "FISICO";
            await prisma.logCiclo.create({ data: { userId, tarea: `Reps: ${evento.descripcion}`, pilar: "FISICO", estado: "COMPLETADO", resultado: `${evento.reps} reps`, xpGanada } }); 
          }
          break;
          
        case "ciclo_inicio":
          xpGanada = 15; 
          await prisma.logCiclo.create({ data: { userId, tarea: evento.descripcion || "Foco", pilar: evento.pilar || "PENSAR", estado: "EN_PROGRESO", xpGanada } });
          break;
          
        case "consumo":
          xpGanada = 10; 
          await prisma.logConsumo.create({ data: { userId, tipo: "COMIDA", descripcion: evento.descripcion, cantidad: evento.cantidad, xpGanada } });
          break;

        // CASO SOCIAL (NUEVO)
        case "social":
          xpGanada = 30; // XP por defecto por socializar
          pilarXP = "SOCIAL";
          await prisma.logSocial.create({
            data: {
              userId,
              tipo: "INTERACCION",
              persona: evento.persona || "Alguien",
              actividad: evento.descripcion || text,
              xpGanada: xpGanada
            }
          });
          break;
      }

      // Sumar XP
      if (xpGanada > 0) {
        const xpField = getXpFieldName(pilarXP);
        await prisma.userStats.update({
          where: { userId },
          data: { 
            // @ts-ignore
            [xpField]: { increment: xpGanada } 
          }
        });
        const msgLevel = await checkLevelUp(userId, pilarXP);
        notaExtra += msgLevel;
      }

      if (evento.reply) respuestasArray.push(`${evento.reply} (+${xpGanada} XP ${pilarXP})${notaExtra}`);
    }
    
    await ctx.reply(respuestasArray.join("\n\n"), { parse_mode: "Markdown" });

  } catch (e) {
    console.error("ERROR:", e);
    try { await ctx.reply("⚠️ Error procesando."); } catch (err) {}
  }
};

if (bot) {
  bot.on("message:text", handleMessage);
}

export const POST = bot ? webhookCallback(bot, "std/http") : async () => Response.json({ error: "No token" });