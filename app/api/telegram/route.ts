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

const SYSTEM_PROMPT = `
Rol: Asistente personal de Franco.
Tarea: Estructurar datos con precisión matemática y responder como un compañero.
Tono: Argentino suave, natural, motivador.

REGLAS MATEMÁTICAS (NORMALIZACIÓN):
1. SÓLIDOS (Peso): Base KILOS. Si dice "gramos", divide por 1000.
2. LÍQUIDOS (Volumen): Base LITROS. Si dice "ml/cc", divide por 1000.
3. UNIDADES: Si no hay unidad, usa la cantidad contable.

REGLAS DE HONESTIDAD:
- Si solo habla de comida, SOLO genera evento "consumo". NO inventes "estado".
- NO inventes valores de energía/concentración si no se mencionan.

REGLAS DE RESPUESTA (IMPORTANTE):
- NO seas cortante. Usa 1 o 2 oraciones completas y naturales.
- Confirma la acción (Anoto, Guardo, Registro) pero integrala en la frase.
- Agrega un toque de empatía o buena onda según el contexto.
- EJEMPLO: "Dale, anoto el bife. ¡Espero que haya estado bueno!"

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
      "reply": "Frase natural y completa",
      "energia": 1-5, "concentracion": 1-5, "resumen": "txt",
      "clase": "COMIDA"|"LIQUIDO", "descripcion": "txt", "cantidad": number,
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
            temperature: 0.7, // Subimos la creatividad para que charle mejor
            max_tokens: 350,  // Le damos más espacio para hablar
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
                    if (evento.energia || evento.concentracion) {
                        await prisma.logEstado.create({ data: { energia: evento.energia, concentracion: evento.concentracion, inputUsuario: text, notasIA: evento.resumen } });
                    }
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

        await ctx.reply(respuestasArray.join("\n\n"));

    } catch (e) {
        console.error("ERROR:", e);
        await ctx.reply("⚠️ Error procesando. Probá de nuevo.");
    }
};

if (bot) {
    bot.on("message:text", handleMessage);
}

export const POST = bot ? webhookCallback(bot, "std/http") : async () => Response.json({ error: "No token" });