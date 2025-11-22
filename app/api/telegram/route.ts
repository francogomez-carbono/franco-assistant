import { Bot, webhookCallback } from "grammy";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

export const dynamic = 'force-dynamic';

const token = process.env.TELEGRAM_TOKEN;
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
IMPORTANTE: Responde SOLO el objeto JSON.
`;

const handleMessage = async (ctx: any) => {
    if (!ctx.message.text) return;
    const text = ctx.message.text;
    
    // Feedback visual (escribiendo...)
    await bot?.api.sendChatAction(ctx.chat.id, "typing");

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }],
            temperature: 0,
            // ESTO ES NUEVO: Fuerza a la IA a devolver JSON válido sí o sí
            response_format: { type: "json_object" }
        });

        const raw = completion.choices[0].message.content || "{}";
        
        // ESTO ES NUEVO: Cirugía para extraer solo el JSON si la IA agrega texto extra
        const firstBrace = raw.indexOf('{');
        const lastBrace = raw.lastIndexOf('}');
        
        let data;
        if (firstBrace !== -1 && lastBrace !== -1) {
            const cleanJson = raw.substring(firstBrace, lastBrace + 1);
            data = JSON.parse(cleanJson);
        } else {
            data = JSON.parse(raw); // Intento directo si no encuentra llaves
        }

        let respuesta = "";

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
        console.error("ERROR REAL:", e); // Esto aparecerá en los logs de Vercel si falla
        await ctx.reply("❌ Error procesando.");
    }
};

if (bot) {
    bot.on("message:text", handleMessage);
}

export const POST = bot ? webhookCallback(bot, "std/http") : async () => Response.json({ error: "No token provided" });