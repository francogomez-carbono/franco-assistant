import { Bot, webhookCallback } from "grammy";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

// 1. AJUSTE CLAVE: Pedimos hasta 60 segundos a Vercel (en plan Hobby a veces lo limita a 10s, pero esto ayuda)
export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

const token = process.env.TELEGRAM_TOKEN;
const bot = token ? new Bot(token) : null;
// Instanciamos Prisma fuera del handler para reusar la conexión (Mejora velocidad)
const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
Eres el asistente personal de Franco. Tu rol es ser un COMPAÑERO de productividad.
Tono: Natural, breve, motivador, argentino suave.

TU TAREA:
1. Analiza el input y extrae JSON.
2. Genera una respuesta ("reply") conversacional.

CATEGORÍAS:
1. PLATA (Trabajo, Coding, Dinero)
2. PENSAR (Estudio, Leer, Planear)
3. FISICO (Entrenar, Salud, Dormir)
4. SOCIAL (Relaciones, Salidas)

FORMATO JSON (ESTRICTO):
{
  "events": [
    {
      "type": "estado" | "consumo" | "ciclo_inicio" | "ciclo_fin" | "nota",
      "reply": "Texto breve aquí",
      ...datos especificos...
    }
  ]
}
DATOS ESPECIFICOS:
- estado: { "energia": 1-5, "concentracion": 1-5, "resumen": "string" }
- consumo: { "clase": "COMIDA" | "LIQUIDO", "descripcion": "string", "cantidad": number | null }
- ciclo_inicio: { "tarea": "string", "pilar": "PLATA" | "PENSAR" | "FISICO" | "SOCIAL" }
- ciclo_fin: { "resultado": "string" }
- nota: { "texto": "string" }
`;

const handleMessage = async (ctx: any) => {
    if (!ctx.message.text) return;
    const text = ctx.message.text;
    
    console.log(`📩 Mensaje recibido: ${text}`); // Log para debug

    // Feedback visual rápido (para que Telegram sepa que estamos vivos)
    await bot?.api.sendChatAction(ctx.chat.id, "typing").catch(() => {});

    try {
        // 2. AJUSTE CLAVE: Limitamos max_tokens para que GPT responda más rápido
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }],
            temperature: 0.7,
            max_tokens: 300, // No dejes que escriba infinito
            response_format: { type: "json_object" }
        });

        const raw = completion.choices[0].message.content || "{}";
        
        // Limpieza JSON
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

        console.log(`🧠 IA procesó ${eventos.length} eventos. Guardando en DB...`);

        // Guardado en DB
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
                    } else {
                        // Si no hay ciclo, solo agregamos el texto de respuesta, no fallamos.
                        console.log("Intento de cierre sin ciclo activo.");
                    }
                    break;
            }
        }
        
        console.log("💾 Guardado exitoso. Respondiendo...");
        await ctx.reply(respuestasArray.join("\n\n"));

    } catch (e) {
        console.error("❌ ERROR FATAL:", e);
        // Si falla, avisa al usuario para que sepa que no se guardó
        await ctx.reply("⏱️ El sistema tardó demasiado (posiblemente la base de datos se estaba despertando). Por favor, probá enviar el mensaje de nuevo.");
    }
};

if (bot) {
    bot.on("message:text", handleMessage);
}

export const POST = bot ? webhookCallback(bot, "std/http") : async () => Response.json({ error: "No token provided" });