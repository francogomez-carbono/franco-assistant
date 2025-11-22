import { Bot, webhookCallback } from "grammy";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

export const dynamic = 'force-dynamic';

// --- CONEXIÓN OPTIMIZADA ---
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const token = process.env.TELEGRAM_TOKEN;
const bot = token ? new Bot(token) : null;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
Rol: Asistente personal de Franco.
Tarea: Estructurar datos y responder confirmando la acción.
Tono: Argentino suave, directo, eficiente pero amigable.

REGLAS DE NORMALIZACIÓN DE CANTIDADES (¡IMPORTANTE!):
1. SÓLIDOS (Peso): La unidad base es KILOS.
   - Si dice "gramos", divide por 1000. (Ej: "30g" -> 0.03, "250g" -> 0.25).
   - Si dice "kilos", mantiene el número.
   
2. LÍQUIDOS (Volumen): La unidad base es LITROS.
   - Si dice "ml" o "cc", divide por 1000. (Ej: "500ml" -> 0.5, "330cc" -> 0.33).
   
3. UNIDADES (Contables):
   - Si no hay peso ni volumen (ej: "2 bananas", "1 bife"), usa la cantidad de unidades.

REGLAS DE RESPUESTA ("reply"):
- Confirma explícitamente qué guardaste (Ej: "Anoto", "Registro").
- Combina con empatía breve.

CATEGORÍAS:
- PLATA: Trabajo, Dinero.
- PENSAR: Estudio, Planificación.
- FISICO: Salud, Gym, Sueño.
- SOCIAL: Gente.

JSON (Strict):
{
  "events": [
    {
      "type": "estado"|"consumo"|"ciclo_inicio"|"ciclo_fin"|"nota",
      "reply": "Frase de confirmación",
      "energia": 1-5, "concentracion": 1-5, "resumen": "txt",
      "clase": "COMIDA"|"LIQUIDO", "descripcion": "txt (ej: Casancrem)", "cantidad": number (YA CONVERTIDO A KG/L),
      "tarea": "txt", "pilar": "PLATA"|"PENSAR"|"FISICO"|"SOCIAL",
      "resultado": "txt", "texto": "txt"
    }
  ]
}
`;

const handleMessage = async (ctx: any) => {
    if (!ctx.message.text) return;
    const text = ctx.message.text;
    
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }],
            temperature: 0.6, 
            max_tokens: 250,
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
            if (evento.reply) respuestasArray.push(evento.reply);

            switch (evento.type) {
                case "estado":
                    await prisma.logEstado.create({ data: { energia: evento.energia, concentracion: evento.concentracion, inputUsuario: text, notasIA: evento.resumen } });
                    break;
                case "consumo":
                    // La IA ya convirtió la cantidad a KG/L gracias al Prompt
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

        await ctx.reply(respuestasArray.join("\n\n"));

    } catch (e) {
        console.error("ERROR:", e);
        await ctx.reply("⚠️ Tardé mucho en procesar. Probá de nuevo.");
    }
};

if (bot) {
    bot.on("message:text", handleMessage);
}

export const POST = bot ? webhookCallback(bot, "std/http") : async () => Response.json({ error: "No token" });