import { Bot, webhookCallback } from "grammy";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

export const dynamic = 'force-dynamic';

const token = process.env.TELEGRAM_TOKEN;
const bot = token ? new Bot(token) : null;
const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
Eres el asistente personal de Franco. Tu trabajo es estructurar su vida en base a sus mensajes.
Recibirás texto natural y deberás convertirlo en una LISTA de eventos JSON.

TUS REGLAS DE DEDUCCIÓN (NO PIDA EL PILAR, DEDÚCELO):
1. PILAR "PLATA": Todo lo relacionado con Trabajo, Coding, Automatización, Bolsa, Marketing, Negocios o Generar Dinero.
2. PILAR "PENSAR": Todo lo relacionado con Estudiar, Leer, Aprender, Planificar, Escribir o Reflexionar.
3. PILAR "FISICO": Todo lo relacionado con Entrenar, Gimnasio, Deportes, Dormir o Salud.
4. PILAR "SOCIAL": Todo lo relacionado con Amigos, Pareja, Networking, Salidas o Familia.

CATEGORÍAS DE EVENTOS:
1. ESTADO: Sentimientos, nivel de energía (1-5), nivel de foco (1-5).
   JSON: {"type": "estado", "energia": number, "concentracion": number, "resumen": "string"}
   
2. CONSUMO: Comida o Bebida.
   JSON: {"type": "consumo", "clase": "COMIDA" o "LIQUIDO", "descripcion": "string", "cantidad": number (ml) o null}

3. CICLO_INICIO: Empezar una actividad. DEDUCE EL PILAR AUTOMÁTICAMENTE.
   JSON: {"type": "ciclo_inicio", "tarea": "string", "pilar": "PLATA" | "PENSAR" | "FISICO" | "SOCIAL"}

4. CICLO_FIN: Terminar lo que estaba haciendo.
   JSON: {"type": "ciclo_fin", "resultado": "string"}

SI EL MENSAJE TIENE MÚLTIPLES ACCIONES, GENERA MÚLTIPLES EVENTOS.

FORMATO DE RESPUESTA JSON (ESTRICTO):
{
  "events": [
    { ...evento1... },
    { ...evento2... }
  ]
}
`;

const handleMessage = async (ctx: any) => {
    if (!ctx.message.text) return;
    const text = ctx.message.text;
    
    await bot?.api.sendChatAction(ctx.chat.id, "typing");

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }],
            temperature: 0,
            response_format: { type: "json_object" }
        });

        const raw = completion.choices[0].message.content || "{}";
        
        // Limpieza de JSON (Cirugía)
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
            switch (evento.type) {
                case "estado":
                    await prisma.logEstado.create({ data: { energia: evento.energia, concentracion: evento.concentracion, inputUsuario: text, notasIA: evento.resumen } });
                    respuestasArray.push(`✅ E${evento.energia}/C${evento.concentracion} - ${evento.resumen}`);
                    break;
                case "consumo":
                    await prisma.logConsumo.create({ data: { tipo: evento.clase, descripcion: evento.descripcion, cantidad: evento.cantidad } });
                    respuestasArray.push(`🍎 ${evento.descripcion}`);
                    break;
                case "ciclo_inicio":
                    // Aquí la IA ya dedujo el pilar
                    await prisma.logCiclo.create({ data: { tarea: evento.tarea, pilar: evento.pilar, estado: "EN_PROGRESO" } });
                    respuestasArray.push(`🚀 Iniciando: ${evento.tarea} (${evento.pilar})`);
                    break;
                case "ciclo_fin":
                    const ultimo = await prisma.logCiclo.findFirst({ where: { fin: null }, orderBy: { inicio: 'desc' } });
                    if (ultimo) {
                        await prisma.logCiclo.update({ where: { id: ultimo.id }, data: { fin: new Date(), estado: "COMPLETADO", resultado: evento.resultado } });
                        respuestasArray.push(`🏁 Ciclo cerrado: ${ultimo.tarea}`);
                    } else { 
                        respuestasArray.push("⚠️ No tenías nada abierto."); 
                    }
                    break;
                default: 
                    if (evento.texto) respuestasArray.push("📝 Nota guardada.");
            }
        }

        await ctx.reply(respuestasArray.join("\n"));

    } catch (e) {
        console.error("ERROR:", e);
        await ctx.reply("❌ Error procesando.");
    }
};

if (bot) {
    bot.on("message:text", handleMessage);
}

export const POST = bot ? webhookCallback(bot, "std/http") : async () => Response.json({ error: "No token provided" });