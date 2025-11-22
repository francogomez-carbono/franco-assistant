import { Bot, webhookCallback } from "grammy";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

export const dynamic = 'force-dynamic';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const token = process.env.TELEGRAM_TOKEN;
const bot = token ? new Bot(token) : null;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- SISTEMA DE GAMIFICATION ---
async function sumarXP(puntos: number) {
    // 1. Buscamos al usuario (o lo creamos si es la primera vez)
    let stats = await prisma.userStats.findFirst();
    if (!stats) {
        stats = await prisma.userStats.create({ data: { xp: 0, level: 1 } });
    }

    // 2. Calculamos nueva XP
    const nuevaXP = stats.xp + puntos;
    const nuevoNivel = Math.floor(nuevaXP / 1000) + 1; // Sube de nivel cada 1000 XP
    let mensajeLevelUp = "";

    // 3. Verificamos si subió de nivel
    if (nuevoNivel > stats.level) {
        mensajeLevelUp = `\n🎉 **¡LEVEL UP!** Ahora sos Nivel ${nuevoNivel}. ¡Sos una máquina! 🦾`;
    }

    // 4. Guardamos
    await prisma.userStats.update({
        where: { id: stats.id },
        data: { xp: nuevaXP, level: nuevoNivel }
    });

    return { msg: `(+${puntos} XP)${mensajeLevelUp}`, totalXP: nuevaXP };
}

const MENSAJE_AYUDA = `
🎮 **LIFE OS - COMANDOS**

🧠 **SEGUNDO CEREBRO:**
• _"Idea: Crear una app de..."_
• _"Recordar buscar precios de..."_

📊 **STATS:**
• _"¿Qué nivel soy?"_
• _"/nivel"_

📝 **REGISTRO:**
• _"Comí..."_ (+10 XP)
• _"Arranco a..."_ (+15 XP)
• _"Terminé..."_ (+50 XP) 🏆
`;

const SYSTEM_PROMPT = `
Rol: Asistente personal de Franco (Life OS + Gamification).
Tarea: Estructurar datos, calcular métricas y motivar.
Tono: Argentino suave, compañero.

NUEVA CATEGORÍA "IDEA":
- Si el usuario comparte un pensamiento, link, recordatorio o epifanía que NO es una tarea inmediata -> Tipo: "idea".

REGLAS DE RESPUESTA:
- Confirma la acción.
- Sé breve y empático.
- NO menciones la XP en tu texto generado (eso lo agrega el sistema automáticamente al final).

JSON (Strict):
{
  "events": [
    {
      "type": "estado"|"consumo"|"ciclo_inicio"|"ciclo_fin"|"idea"|"nota",
      "reply": "Tu respuesta conversacional",
      "energia": 1-5, "concentracion": 1-5, "resumen": "txt",
      "clase": "COMIDA"|"LIQUIDO", "descripcion": "txt", "cantidad": num,
      "tarea": "txt", "pilar": "PLATA"|"PENSAR"|"FISICO"|"SOCIAL",
      "resultado": "txt", "texto": "txt", "tags_idea": "txt"
    }
  ]
}
`;

const handleMessage = async (ctx: any) => {
    if (!ctx.message.text) return;
    const text = ctx.message.text;

    // --- COMANDOS RÁPIDOS ---
    if (text === "/comandos" || text === "/ayuda") {
        await ctx.reply(MENSAJE_AYUDA, { parse_mode: "Markdown" });
        return;
    }
    if (text === "/nivel" || text.toLowerCase().includes("que nivel soy")) {
        const stats = await prisma.userStats.findFirst();
        const xp = stats?.xp || 0;
        const level = stats?.level || 1;
        const falta = 1000 - (xp % 1000);
        await ctx.reply(`🏆 **PERFIL DE JUGADOR**\n\n👤 Nivel: ${level}\n✨ XP Total: ${xp}\n🚀 Falta para Nivel ${level + 1}: ${falta} XP`);
        return;
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }],
            temperature: 0.6, 
            max_tokens: 350,
            response_format: { type: "json_object" }
        });

        const raw = completion.choices[0].message.content || "{}";
        const firstBrace = raw.indexOf('{');
        const lastBrace = raw.lastIndexOf('}');
        
        let data;
        if (firstBrace !== -1 && lastBrace !== -1) {
            data = JSON.parse(raw.substring(firstBrace, lastBrace + 1));
        } else {
            data = JSON.parse(raw);
        }

        const eventos = data.events || [data]; 
        let respuestasArray: string[] = [];

        for (const evento of eventos) {
            let xpGanada = 0;

            switch (evento.type) {
                case "estado":
                    if (evento.energia || evento.concentracion) {
                        await prisma.logEstado.create({ data: { energia: evento.energia, concentracion: evento.concentracion, inputUsuario: text, notasIA: evento.resumen } });
                        xpGanada = 10;
                    }
                    break;
                case "consumo":
                    await prisma.logConsumo.create({ data: { tipo: evento.clase, descripcion: evento.descripcion, cantidad: evento.cantidad } });
                    xpGanada = 10;
                    break;
                case "ciclo_inicio":
                    await prisma.logCiclo.create({ data: { tarea: evento.tarea, pilar: evento.pilar, estado: "EN_PROGRESO" } });
                    xpGanada = 15;
                    break;
                case "ciclo_fin":
                    const ultimo = await prisma.logCiclo.findFirst({ where: { fin: null }, orderBy: { inicio: 'desc' } });
                    if (ultimo) {
                        await prisma.logCiclo.update({ where: { id: ultimo.id }, data: { fin: new Date(), estado: "COMPLETADO", resultado: evento.resultado } });
                        xpGanada = 50; // ¡Premio mayor!
                    }
                    break;
                case "idea":
                    await prisma.logIdea.create({ data: { idea: evento.texto || evento.descripcion || text, tags: evento.tags_idea } });
                    xpGanada = 20;
                    break;
                default:
                    xpGanada = 5; // Nota simple
            }

            // Sumar XP y obtener mensaje
            let suffixXP = "";
            if (xpGanada > 0) {
                const resultadoXP = await sumarXP(xpGanada);
                suffixXP = ` _${resultadoXP.msg}_`;
            }

            if (evento.reply) {
                respuestasArray.push(`${evento.reply}${suffixXP}`);
            }
        }

        await ctx.reply(respuestasArray.join("\n\n"), { parse_mode: "Markdown" });

    } catch (e) {
        console.error("ERROR:", e);
        await ctx.reply("⚠️ Error procesando.");
    }
};

if (bot) {
    bot.on("message:text", handleMessage);
}

export const POST = bot ? webhookCallback(bot, "std/http") : async () => Response.json({ error: "No token" });