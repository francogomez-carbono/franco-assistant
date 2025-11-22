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

// --- SISTEMA DE GAMIFICATION AVANZADO ---
async function sumarXP(puntos: number, pilar: "PLATA" | "PENSAR" | "FISICO" | "SOCIAL") {
    let stats = await prisma.userStats.findFirst();
    if (!stats) {
        stats = await prisma.userStats.create({ data: {} });
    }

    // Mapeo dinámico para saber qué campo tocar según el pilar
    const map = {
        "PLATA": { xp: "xpPlata", lvl: "lvlPlata" },
        "PENSAR": { xp: "xpPensar", lvl: "lvlPensar" },
        "FISICO": { xp: "xpFisico", lvl: "lvlFisico" },
        "SOCIAL": { xp: "xpSocial", lvl: "lvlSocial" }
    };

    const campoXP = map[pilar].xp as keyof typeof stats;
    const campoLvl = map[pilar].lvl as keyof typeof stats;

    // Obtenemos valores actuales
    let currentXP = stats[campoXP] as number;
    let currentLvl = stats[campoLvl] as number;

    // Sumamos XP
    currentXP += puntos;
    let mensajeLevelUp = "";

    // Lógica de Nivel: Costo = NivelActual * 100
    // Ejemplo Nivel 1: Necesita 100 XP para subir.
    // Ejemplo Nivel 2: Necesita 200 XP para subir.
    let costoProximoNivel = currentLvl * 100;

    // Bucle por si ganaste tanta XP que subís varios niveles de una
    while (currentXP >= costoProximoNivel) {
        currentXP -= costoProximoNivel; // Restamos la XP usada para subir
        currentLvl++;                   // Subimos nivel
        costoProximoNivel = currentLvl * 100; // Nuevo costo para el siguiente
        mensajeLevelUp = `\n🎉 **¡LEVEL UP!** Ahora sos Nivel ${currentLvl} en ${pilar}. 🦾`;
    }

    // Guardamos en DB dinámicamente
    await prisma.userStats.update({
        where: { id: stats.id },
        data: {
            [campoXP]: currentXP,
            [campoLvl]: currentLvl
        }
    });

    return { msg: `(+${puntos} XP ${pilar})${mensajeLevelUp}`, nivelActual: currentLvl };
}

const MENSAJE_AYUDA = `
🎮 **REGLAS DE JUEGO (PRO)**

Cada pilar tiene su propio nivel. Para subir de nivel X a Y, necesitás X * 100 de XP.

🧠 **DEEP WORK:** >2hs = **100 XP** (Plata/Pensar)
🛌 **SUEÑO:** >7hs = **100 XP** (Físico)
💪 **ENTRENAMIENTO:** 1 Rep = 1 XP
⏳ **AYUNO:** 1 Hora = 10 XP
`;

const SYSTEM_PROMPT = `
Rol: Gamemaster y Asistente de Franco.
Tarea: Estructurar datos y asignar XP al pilar correcto.

REGLAS DE PILARES (XP):
- Ideas: Asigna "PENSAR" por defecto, salvo que sea de negocios ("PLATA").
- Consumo: Asigna "FISICO" por defecto.
- Estado: Asigna "FISICO" (energía) o "PENSAR" (concentración) según contexto.

JSON (Strict):
{
  "events": [
    {
      "type": "estado"|"consumo"|"ciclo_inicio"|"ciclo_fin"|"idea"|"ejercicio_reps"|"ayuno"|"sueno"|"nota",
      "reply": "Confirmación empática",
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

    // --- COMANDO /NIVEL ACTUALIZADO ---
    if (text === "/nivel" || text.toLowerCase().includes("que nivel")) {
        let stats = await prisma.userStats.findFirst();
        if (!stats) stats = await prisma.userStats.create({ data: {} });

        // Calculamos progreso de cada barra
        const barra = (val: number, max: number) => {
            const porcentaje = Math.min(10, Math.floor((val / max) * 10));
            return "🟦".repeat(porcentaje) + "⬜".repeat(10 - porcentaje);
        };

        const totalLvl = stats.lvlPlata + stats.lvlPensar + stats.lvlFisico + stats.lvlSocial;

        const msg = `
🏆 **PERFIL DE JUGADOR (Nivel Total: ${totalLvl})**

💰 **PLATA (Lvl ${stats.lvlPlata})**
${barra(stats.xpPlata, stats.lvlPlata * 100)} ${stats.xpPlata}/${stats.lvlPlata * 100} XP

🧠 **PENSAR (Lvl ${stats.lvlPensar})**
${barra(stats.xpPensar, stats.lvlPensar * 100)} ${stats.xpPensar}/${stats.lvlPensar * 100} XP

💪 **FÍSICO (Lvl ${stats.lvlFisico})**
${barra(stats.xpFisico, stats.lvlFisico * 100)} ${stats.xpFisico}/${stats.lvlFisico * 100} XP

❤️ **SOCIAL (Lvl ${stats.lvlSocial})**
${barra(stats.xpSocial, stats.lvlSocial * 100)} ${stats.xpSocial}/${stats.lvlSocial * 100} XP
`;
        await ctx.reply(msg);
        return;
    }

    if (text === "/comandos" || text === "/ayuda") {
        await ctx.reply(MENSAJE_AYUDA, { parse_mode: "Markdown" });
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
            let pilarXP: "PLATA" | "PENSAR" | "FISICO" | "SOCIAL" = "FISICO"; // Default
            let notaExtra = "";

            switch (evento.type) {
                case "sueno":
                    const horasSueno = evento.horas_sueno || evento.cantidad || 0;
                    pilarXP = "FISICO";
                    if (horasSueno > 7) {
                        xpGanada = 100;
                        notaExtra = " (Recovery Bonus 💤)";
                    }
                    await prisma.logConsumo.create({ data: { tipo: "SUENO", descripcion: `Sueño ${horasSueno}hs`, cantidad: horasSueno } });
                    break;

                case "ciclo_fin":
                    const ultimo = await prisma.logCiclo.findFirst({ where: { fin: null }, orderBy: { inicio: 'desc' } });
                    if (ultimo) {
                        const ahora = new Date();
                        const duracionHoras = (ahora.getTime() - new Date(ultimo.inicio).getTime()) / (1000 * 60 * 60);
                        await prisma.logCiclo.update({ where: { id: ultimo.id }, data: { fin: ahora, estado: "COMPLETADO", resultado: evento.resultado } });
                        
                        // XP al pilar del ciclo
                        pilarXP = ultimo.pilar as any; 
                        if (duracionHoras > 2) {
                            xpGanada = 100;
                            notaExtra = " (Deep Work 🔥)";
                        } else {
                            xpGanada = 50;
                        }
                    }
                    break;

                case "ejercicio_reps":
                    const reps = evento.reps || 0;
                    pilarXP = "FISICO";
                    if (reps >= 10) {
                        xpGanada = reps;
                        await prisma.logCiclo.create({ data: { tarea: `Reps: ${evento.descripcion}`, pilar: "FISICO", estado: "COMPLETADO", resultado: `${reps} reps` } });
                    }
                    break;

                case "ayuno":
                    const horasAyuno = evento.horas_ayuno || evento.cantidad || 0;
                    pilarXP = "FISICO";
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
                        pilarXP = "FISICO"; // Por defecto, estado es físico/mental
                    }
                    break;

                case "consumo":
                    await prisma.logConsumo.create({ data: { tipo: evento.clase, descripcion: evento.descripcion, cantidad: evento.cantidad } });
                    xpGanada = 10;
                    pilarXP = "FISICO";
                    break;

                case "ciclo_inicio":
                    await prisma.logCiclo.create({ data: { tarea: evento.tarea, pilar: evento.pilar, estado: "EN_PROGRESO" } });
                    xpGanada = 15;
                    pilarXP = evento.pilar; // XP va al pilar que inicia
                    break;

                case "idea":
                    await prisma.logIdea.create({ data: { idea: evento.texto || evento.descripcion || text, tags: evento.tags_idea } });
                    xpGanada = 20;
                    pilarXP = "PENSAR"; // Ideas van a Pensar
                    break;
            }

            let suffixXP = "";
            if (xpGanada > 0) {
                const resultadoXP = await sumarXP(xpGanada, pilarXP);
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