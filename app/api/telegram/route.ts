import { Bot, webhookCallback } from "grammy";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

export const dynamic = 'force-dynamic';

// --- 1. OPTIMIZACIÓN DE CONEXIÓN (Singleton) ---
// Esto evita reconectar a la DB en cada mensaje, ahorrando 1-2 segundos.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const token = process.env.TELEGRAM_TOKEN;
const bot = token ? new Bot(token) : null;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- 2. PROMPT COMPACTO (Para que GPT lea más rápido) ---
const SYSTEM_PROMPT = `
Rol: Asistente productivo de Franco.
Tarea: Convierte input en JSON de eventos.
Tono: Breve, argentino.

REGLAS:
- PLATA: Trabajo, Dinero.
- PENSAR: Estudio, Planificación.
- FISICO: Salud, Gym, Sueño.
- SOCIAL: Gente.

JSON (Strict):
{
  "events": [
    {
      "type": "estado"|"consumo"|"ciclo_inicio"|"ciclo_fin"|"nota",
      "reply": "Respuesta MUY corta",
      "energia": 1-5, "concentracion": 1-5, "resumen": "txt",
      "clase": "COMIDA"|"LIQUIDO", "descripcion": "txt", "cantidad": num,
      "tarea": "txt", "pilar": "PLATA"|"PENSAR"|"FISICO"|"SOCIAL",
      "resultado": "txt", "texto": "txt"
    }
  ]
}
`;

const handleMessage = async (ctx: any) => {
    if (!ctx.message.text) return;
    const text = ctx.message.text;
    
    // Eliminamos el "sendChatAction" para ahorrar 500ms de red
    
    try {
        // OpenAI con timeout manual para no colgar a Vercel
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }],
            temperature: 0.5, // Menos creatividad = Más velocidad
            max_tokens: 150,  // Respuesta corta obligatoria
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

        // Ejecutamos las promesas de DB en paralelo si es posible, pero secuencial es más seguro para lógica
        for (const evento of eventos) {
            if (evento.reply) respuestasArray.push(evento.reply);

            switch (evento.type) {
                case "estado":
                    await prisma.logEstado.create({ data: { energia: evento.energia, concentracion: evento.concentracion, inputUsuario: text, notasIA: evento.resumen } });
                    break;
                case "consumo":
                    await prisma.logConsumo.create({ data: { tipo: evento.clase, descripcion: evento.descripcion, cantidad: evento.cantidad } });
                    break;
                case "ciclo_inicio":
                    await prisma.logCiclo.create({ data: { tarea: evento.tarea, pilar: evento.pilar, estado: "EN_PROGRESO" } });
                    break;
                case "ciclo_fin":
                    const ultimo = await prisma.logCiclo.findFirst({ where: { fin: null }, orderBy: { inicio: 'desc' } });
                    if (ultimo) {
                        await prisma.logCiclo.update({ where: { id: ultimo.id }, data: { fin: new Date(), estado: "COMPLETADO", resultado: evento.resultado } });
                    }
                    break;
            }
        }

        await ctx.reply(respuestasArray.join("\n"));

    } catch (e) {
        console.error("ERROR:", e);
        // Mensaje de error más corto
        await ctx.reply("⚠️ Error de tiempo. Intenta frases más cortas.");
    }
};

if (bot) {
    bot.on("message:text", handleMessage);
}

export const POST = bot ? webhookCallback(bot, "std/http") : async () => Response.json({ error: "No token" });