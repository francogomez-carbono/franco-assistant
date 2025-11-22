import { Bot, webhookCallback } from "grammy";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const prisma = new PrismaClient();
const token = process.env.TELEGRAM_TOKEN;
const bot = token ? new Bot(token) : null;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- HELPER: SANITIZAR NOMBRES ---
function getXpFieldName(pilar: string) {
  const cleanPilar = pilar.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return `xp${cleanPilar.charAt(0).toUpperCase() + cleanPilar.slice(1).toLowerCase()}`;
}

function getLvlFieldName(pilar: string) {
  const cleanPilar = pilar.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return `lvl${cleanPilar.charAt(0).toUpperCase() + cleanPilar.slice(1).toLowerCase()}`;
}

// --- HELPER: LOGICA LEVEL UP ---
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

// --- HELPER: OBTENER USUARIO ---
async function getUser(ctx: any) {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return null;

  let user = await prisma.user.findUnique({
    where: { telegramId },
    include: { stats: true }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId,
        stats: { create: {} }
      },
      include: { stats: true }
    });
  }
  return user;
}

const SYSTEM_PROMPT_LOGGER = `
Rol: Gamemaster y Asistente.
Tarea: Estructurar datos y asignar XP.
REGLAS CRÍTICAS:
1. ENTRENAMIENTO: Si dice "4 series de 12", MULTIPLICA (4*12=48) y ponlo en 'reps'.
2. DESCRIPTION: Mantén el detalle original.
JSON (Strict):
{
  "events": [
    {
      "type": "estado"|"consumo"|"ciclo_inicio"|"ciclo_fin"|"idea"|"ejercicio_reps"|"ayuno"|"sueno"|"nota"|"addiction_start"|"addiction_relapse"|"social",
      "reply": "Confirmación empática muy breve",
      "energia": 1-5, "concentracion": 1-5, "resumen": "txt",
      "clase": "COMIDA"|"LIQUIDO"|"AYUNO"|"SUENO", "descripcion": "txt", "cantidad": number,
      "tarea": "txt", "pilar": "PLATA"|"PENSAR"|"FISICO"|"SOCIAL",
      "resultado": "txt", "texto": "txt", "tags_idea": "txt",
      "reps": number, "horas_ayuno": number, "horas_sueno": number, "vicio": "txt",
      "persona": "txt", "duracion_social": number, "valoracion_social": 1-5
    }
  ]
}
`;

const handleMessage = async (ctx: any) => {
  if (!ctx.message?.text) return;

  // --- MODO TEST: EVITAR LLAMAR A TELEGRAM REAL ---
  // Si el ID es el del test, reemplazamos la función reply por un console.log
  if (ctx.chat.id === 999999999) {
    ctx.reply = async (text: string) => {
      console.log(`[TEST MODE] Bot Reply simulado: ${text}`);
    };
  }
  
  const user = await getUser(ctx);
  if (!user) return;
  
  const userId = user.id;
  const text = ctx.message.text;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT_LOGGER }, { role: "user", content: text }],
      temperature: 0.5, max_tokens: 400, response_format: { type: "json_object" }
    });

    const raw = completion.choices[0].message.content || "{}";
    const data = JSON.parse(raw);
    const eventos = data.events || [data]; 
    let respuestasArray: string[] = [];

    for (const evento of eventos) {
      let xpGanada = 0;
      let pilarXP = evento.pilar || "FISICO"; 
      let notaExtra = "";

      // Logica de Eventos
      switch (evento.type) {
        case "ejercicio_reps":
          const reps = evento.reps || 0; pilarXP = "FISICO";
          if (reps >= 1) { 
            xpGanada = reps; 
            await prisma.logCiclo.create({ data: { userId, tarea: `Reps: ${evento.descripcion}`, pilar: "FISICO", estado: "COMPLETADO", resultado: `${reps} reps`, xpGanada: xpGanada } }); 
          }
          break;
        // Puedes agregar más casos aquí si el test lo requiere
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
    console.error("ERROR LÓGICO:", e);
    // Intentamos avisar, pero si falla (ej: usuario test mal configurado), no crasheamos todo
    try { await ctx.reply("⚠️ Error procesando."); } catch (err) {}
  }
};

if (bot) {
  bot.on("message:text", handleMessage);
}

export const POST = bot ? webhookCallback(bot, "std/http") : async () => Response.json({ error: "No token" });