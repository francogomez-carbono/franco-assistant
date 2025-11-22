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

// --- SISTEMA DE XP ---
async function sumarXP(puntos: number) {
    let stats = await prisma.userStats.findFirst();
    if (!stats) {
        stats = await prisma.userStats.create({ data: { xp: 0, level: 1 } });
    }

    const nuevaXP = stats.xp + puntos;
    const nuevoNivel = Math.floor(nuevaXP / 1000) + 1;
    let mensajeLevelUp = "";

    if (nuevoNivel > stats.level) {
        mensajeLevelUp = `\n🎉 **¡LEVEL UP!** Ahora sos Nivel ${nuevoNivel}. 🦾`;
    }

    await prisma.userStats.update({
        where: { id: stats.id },
        data: { xp: nuevaXP, level: nuevoNivel }
    });

    return { msg: `(+${puntos} XP)${mensajeLevelUp}`, totalXP: nuevaXP };
}

const MENSAJE_AYUDA = `
🎮 **REGLAS DE JUEGO (XP)**

🧠 **DEEP WORK:**
• Trabajar > 2 horas seguidas = **100 XP** 🏆
• Trabajar < 2 horas = 50 XP

🛌 **SUEÑO REPARADOR:**
• Dormir > 7 horas = **100 XP** 💤
• Dormir menos = 0 XP

💪 **ENTRENAMIENTO:**
• 1 Rep = 1 XP (Mínimo 10 reps)

⏳ **AYUNO:**
• 1 Hora = 10 XP (Mínimo 12 hs)
`;

const SYSTEM_PROMPT = `
Rol: Asistente personal y Gamemaster de Franco.
Tarea: Estructurar datos y calcular reglas.
Tono: Argentino suave, compañero.

REGLAS DE INPUT:
1. SUEÑO: Si dice "Dormí X horas", extrae las horas.
2. EJERCICIO: Si dice "Hice X flexiones/reps", extrae las reps.
3. AYUNO: Si dice "Ayuné X horas", extrae horas.

REGLAS DE NORMALIZACIÓN:
- Peso: gramos / 1000 = KG.
- Volumen: ml / 1000 = LITROS.

JSON (Strict):
{
  "events": [
    {
      "type": "estado"|"consumo"|"ciclo_inicio"|"ciclo_fin"|"idea"|"ejercicio_reps"|"ayuno"|"sueno"|"nota",
      "reply": "Confirmación + Empatía",
      "energia": 1-5, "concentracion": 1-5, "resumen": "txt",
      "clase": "COMIDA"|"LIQUIDO"|"AYUNO"|"SUENO", "descripcion": "txt", "cantidad": number,
      "tarea": "txt", "pilar": "PLATA"|"PENSAR"|"FISICO"|"SOCIAL",
      "resultado": "txt", "texto": "txt", "tags_idea": "txt",
      "reps": number, "horas_ayuno": number, "horas_sueno": number
    }
  ]
}
`;

const handleMessage = async (ctx: any) => {
    if (!ctx.message.text) return;
    const text = ctx.message.text;

    if (text === "/comandos" || text === "/ayuda") {
        await ctx.reply(MENSAJE_AYUDA, { parse_mode: "Markdown" });
        return;
    }
    if (text === "/nivel") {
        const stats = await prisma.userStats.findFirst();
        await ctx.reply(`🏆 Nivel: ${stats?.level || 1} | XP: ${stats?.xp || 0}`);
        return;
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }],
            temperature: 0.5,
            max_tokens: 400,
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
            let notaExtra = "";

            switch (evento.type) {
                // --- SUEÑO REPARADOR ---
                case "sueno":
                    const horasSueno = evento.horas_sueno || evento.cantidad || 0;
                    if (horasSueno > 7) {
                        xpGanada = 100; // ¡Bono Recuperación!
                        notaExtra = " (Recovery Bonus 💤)";
                    }
                    await prisma.logConsumo.create({ 
                        data: { tipo: "SUENO", descripcion: `Sueño de ${horasSueno}hs`, cantidad: horasSueno } 
                    });
                    break;

                // --- CICLO FIN (DEEP WORK CHECK) ---
                case "ciclo_fin":
                    const ultimo = await prisma.logCiclo.findFirst({ where: { fin: null }, orderBy: { inicio: 'desc' } });
                    if (ultimo) {
                        const ahora = new Date();
                        const inicio = new Date(ultimo.inicio);
                        // Calculamos diferencia en horas (milisegundos / 1000 / 60 / 60)
                        const duracionHoras = (ahora.getTime() - inicio.getTime()) / (1000 * 60 * 60);

                        await prisma.logCiclo.update({ where: { id: ultimo.id }, data: { fin: ahora, estado: "COMPLETADO", resultado: evento.resultado } });

                        if (duracionHoras > 2) {
                            xpGanada = 100; // ¡Bono Deep Work!
                            notaExtra = ` (Deep Work de ${duracionHoras.toFixed(1)}hs 🔥)`;
                        } else {
                            xpGanada = 50; // Cierre normal
                        }
                    }
                    break;

                // --- RESTO DE REGLAS ---
                case "ejercicio_reps":
                    const reps = evento.reps || 0;
                    if (reps >= 10) {
                        xpGanada = reps; 
                        await prisma.logCiclo.create({ data: { tarea: `Ejercicio: ${evento.descripcion || 'Reps'}`, pilar: "FISICO", estado: "COMPLETADO", resultado: `${reps} reps` } });
                    }
                    break;
                case "ayuno":
                    const horasAyuno = evento.horas_ayuno || evento.cantidad || 0;
                    if (horasAyuno >= 12) {
                        xpGanada = horasAyuno * 10;
                        await prisma.logConsumo.create({ data: { tipo: "AYUNO", descripcion: `Ayuno ${horasAyuno}hs`, cantidad: horasAyuno } });
                    } else {
                        await prisma.logConsumo.create({ data: { tipo: "AYUNO", descripcion: `Ayuno corto`, cantidad: horasAyuno } });
                    }
                    break;
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
                case "idea":
                    await prisma.logIdea.create({ data: { idea: evento.texto || evento.descripcion || text, tags: evento.tags_idea } });
                    xpGanada = 20;
                    break;
                default:
                    xpGanada = 5;
            }

            let suffixXP = "";
            if (xpGanada > 0) {
                const resultadoXP = await sumarXP(xpGanada);
                suffixXP = ` _${resultadoXP.msg}${notaExtra}_`;
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