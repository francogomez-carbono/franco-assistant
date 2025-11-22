import { Bot, webhookCallback } from "grammy";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

export const dynamic = 'force-dynamic';

const token = process.env.TELEGRAM_TOKEN;
const bot = token ? new Bot(token) : null;
const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
Eres el asistente personal de Franco. Tu rol no es solo registrar datos, sino ser un COMPAÑERO de productividad.
Tu tono debe ser: Natural, breve, motivador y directo. Puedes usar modismos argentinos suaves ("Dale", "Bien ahí", "Che").

TU TAREA:
1. Analiza el input para extraer datos estructurados (JSON).
2. Genera una respuesta de texto ("reply") conversacional y empática para Franco basada en lo que él dijo.

REGLAS DE RESPUESTA ("reply"):
- Si empieza a trabajar: Deséale foco y recuérdale que avise al terminar.
- Si termina: Felicítalo y cierra el tema.
- Si come/bebe: Confirma de forma casual.
- Si se siente mal: Muestra empatía breve.

CATEGORÍAS DE DEDUCCIÓN:
1. PLATA: Trabajo, Coding, Negocios.
2. PENSAR: Estudio, Lectura, Planificación.
3. FISICO: Entrenar, Salud, Dormir.
4. SOCIAL: Relaciones, Salidas.

FORMATO JSON (ESTRICTO):
{
  "events": [
    {
      "type": "estado" | "consumo" | "ciclo_inicio" | "ciclo_fin" | "nota",
      "reply": "Tu respuesta conversacional aquí",
      ... datos específicos del tipo ...
    }
  ]
}

DATOS ESPECÍFICOS POR TIPO:
- estado: { "energia": 1-5, "concentracion": 1-5, "resumen": "string" }
- consumo: { "clase": "COMIDA" | "LIQUIDO", "descripcion": "string", "cantidad": number | null }
- ciclo_inicio: { "tarea": "string", "pilar": "PLATA" | "PENSAR" | "FISICO" | "SOCIAL" }
- ciclo_fin: { "resultado": "string" }
- nota: { "texto": "string" }
`;

const handleMessage = async (ctx: any) => {
    if (!ctx.message.text) return;
    const text = ctx.message.text;
    
    await bot?.api.sendChatAction(ctx.chat.id, "typing");

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }],
            temperature: 0.7, // Un poco más de creatividad para la charla
            response_format: { type: "json_object" }
        });

        const raw = completion.choices[0].message.content || "{}";
        
        // Limpieza de JSON
        const firstBrace = raw.indexOf('{');
        const lastBrace = raw.lastIndexOf('}');
        
        let data;
        if (firstBrace !== -1 && lastBrace !== -1) {
            const cleanJson = raw.substring(firstBrace, lastBrace + 1);
            data = JSON.parse(cleanJson);
        } else {
            data = JSON.parse(raw);
        }

        const eventos = data.events || [data]; 
        let respuestasArray: string[] = [];

        for (const evento of eventos) {
            // Usamos la respuesta generada por la IA
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
                        // Si la IA trató de cerrar un ciclo pero no había uno en DB, agregamos una nota visual
                        respuestasArray.push("(Nota: No encontré un ciclo abierto en la base de datos, pero registré el cierre).");
                    }
                    break;
            }
        }

        await ctx.reply(respuestasArray.join("\n\n"));

    } catch (e) {
        console.error("ERROR:", e);
        await ctx.reply("❌ Error procesando. Intentá de nuevo.");
    }
};

if (bot) {
    bot.on("message:text", handleMessage);
}

export const POST = bot ? webhookCallback(bot, "std/http") : async () => Response.json({ error: "No token provided" });