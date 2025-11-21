import { Bot, webhookCallback } from "grammy";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

export const dynamic = 'force-dynamic';

const token = process.env.TELEGRAM_TOKEN;
// Si estamos construyendo la app y no hay token, no falla, pero no inicia el bot
const bot = token ? new Bot(token) : null;
const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
Eres el asistente de Franco. Tu objetivo es categorizar input en JSON.
CATEGORÍAS:
1. ESTADO: {"type": "estado", "energia": 1-5, "concentracion": 1-5, "resumen": "string"}
2. CONSUMO: {"type": "consumo", "clase": "COMIDA" o "LIQUIDO", "descripcion": "string", "cantidad": number o null}
3. CICLO_INICIO: {"type": "ciclo_inicio", "tarea": "string", "pilar": "PLATA" o "PENSAR"}
4. CICLO_FIN: {"type": "ciclo_fin", "resultado": "string"}
Si no encaja: {"type": "nota", "texto": "string"}
Responde SOLO JSON.
`;

// Lógica principal del mensaje
const handleMessage = async (ctx: any) => {
    if (!ctx.message.text) return;
    const text = ctx.message.text;
    
    // Feedback visual rápido
    await ctx.reply("⏳ ...");

    try {
        // 1. Consultar a OpenAI
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }],
            temperature: 0,
        });

        const raw = completion.choices[0].message.content || "{}";
        const cleanJson = raw.replace(/```json/g, "").replace(/```/g, "").trim();
        const data = JSON.parse(cleanJson);
        let respuesta = "";

        // 2. Guardar en la Base de Datos según el tipo
        switch (data.type) {
            case "estado":
                await prisma.logEstado.create({ data: { energia: data.energia, concentracion: data.concentracion, inputUsuario: text, notasIA: data.resumen } });
                respuesta = `✅ E${data.energia}/C${data.concentracion}`;
                break;
            case "consumo":
                await prisma.logConsumo.create({ data: { tipo: data.clase, descripcion: data.descripcion, cantidad: data.cantidad } });
                respuesta = `🍎 ${data.descripcion}`;
                break;
            case "ciclo_inicio":
                await prisma.logCiclo.create({ data: { tarea: data.tarea, pilar: data.pilar, estado: "EN_PROGRESO" } });
                respuesta = `🚀 ${data.tarea}`;
                break;
            case "ciclo_fin":
                const ultimo = await prisma.logCiclo.findFirst({ where: { fin: null }, orderBy: { inicio: 'desc' } });
                if (ultimo) {
                    await prisma.logCiclo.update({ where: { id: ultimo.id }, data: { fin: new Date(), estado: "COMPLETADO", resultado: data.resultado } });
                    respuesta = "🏁 Fin ciclo.";
                } else { respuesta = "⚠️ Sin ciclo activo."; }
                break;
            default: 
                respuesta = "📝 Nota guardada.";
        }
        await ctx.reply(respuesta);
    } catch (e) {
        console.error(e);
        await ctx.reply("❌ Error procesando.");
    }
};

// Solo activamos el listener si el bot se inicializó correctamente
if (bot) {
    bot.on("message:text", handleMessage);
}

// Exportamos la función POST para que Vercel/Telegram la usen
export const POST = bot ? webhookCallback(bot, "std/http") : async () => Response.json({ error: "No token provided" });