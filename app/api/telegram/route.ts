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
async function sumarXP(puntos: number, pilar: "PLATA" | "PENSAR" | "FISICO" | "SOCIAL") {
    let stats = await prisma.userStats.findFirst();
    if (!stats) {
        stats = await prisma.userStats.create({ data: {} });
    }

    const map = {
        "PLATA": { xp: "xpPlata", lvl: "lvlPlata" },
        "PENSAR": { xp: "xpPensar", lvl: "lvlPensar" },
        "FISICO": { xp: "xpFisico", lvl: "lvlFisico" },
        "SOCIAL": { xp: "xpSocial", lvl: "lvlSocial" }
    };

    const campoXP = map[pilar].xp as keyof typeof stats;
    const campoLvl = map[pilar].lvl as keyof typeof stats;

    let currentXP = stats[campoXP] as number;
    let currentLvl = stats[campoLvl] as number;

    currentXP += puntos;
    let mensajeLevelUp = "";
    let costoProximoNivel = currentLvl * 100;

    while (currentXP >= costoProximoNivel) {
        currentXP -= costoProximoNivel;
        currentLvl++;
        costoProximoNivel = currentLvl * 100;
        mensajeLevelUp = `\n🎉 **¡LEVEL UP!** Ahora sos Nivel ${currentLvl} en ${pilar}. 🦾`;
    }

    await prisma.userStats.update({
        where: { id: stats.id },
        data: { [campoXP]: currentXP, [campoLvl]: currentLvl }
    });

    return { msg: `(+${puntos} XP ${pilar})${mensajeLevelUp}`, nivelActual: currentLvl };
}

const MENSAJE_AYUDA = `
🎮 **COMANDOS LIFE OS**

🛡️ **ADICCIONES (DETOX):**
• _"Quiero dejar el azúcar"_ (Inicia contador)
• _"Recaí en azúcar"_ (Resetea contador y guarda récord)

🧠 **DEEP WORK:** >2hs = **100 XP**
🛌 **SUEÑO:** >7hs = **100 XP**
💪 **ENTRENAMIENTO:** 1 Rep = 1 XP
⏳ **AYUNO:** 1 Hora = 10 XP
`;

const SYSTEM_PROMPT = `
Rol: Gamemaster y Asistente.
Tarea: Estructurar datos, gestionar XP y Adicciones.

REGLAS DE ADICCIONES:
- "Quiero dejar X" -> Type: "addiction_start", vicio: "X".
- "Recaí en X" o "Perdí racha de X" -> Type: "addiction_relapse", vicio: "X".

REGLAS DE PILARES (XP):
- Ideas: "PENSAR" (default) o "PLATA".
- Consumo/Adicciones: "FISICO".

JSON (Strict):
{
  "events": [
    {
      "type": "estado"|"consumo"|"ciclo_inicio"|"ciclo_fin"|"idea"|"ejercicio_reps"|"ayuno"|"sueno"|"addiction_start"|"addiction_relapse"|"nota",
      "reply": "Confirmación empática",
      "energia": 1-5, "concentracion": 1-5, "resumen": "txt",
      "clase": "COMIDA"|"LIQUIDO"|"AYUNO"|"SUENO", "descripcion": "txt", "cantidad": number,
      "tarea": "txt", "pilar": "PLATA"|"PENSAR"|"FISICO"|"SOCIAL",
      "resultado": "txt", "texto": "txt", "tags_idea": "txt",
      "reps": number, "horas_ayuno": number, "horas_sueno": number,
      "vicio": "txt"
    }
  ]
}
`;

const handleMessage = async (ctx: any) => {
    if (!ctx.message.text) return;
    const text = ctx.message.text;

    if (text === "/nivel" || text.toLowerCase().includes("que nivel")) {
        let stats = await prisma.userStats.findFirst();
        if (!stats) stats = await prisma.userStats.create({ data: {} });
        
        const barra = (val: number, max: number) => {
            const porcentaje = Math.min(10, Math.floor((val / max) * 10));
            return "🟦".repeat(porcentaje) + "⬜".repeat(10 - porcentaje);
        };

        await ctx.reply(`
🏆 **PERFIL DE JUGADOR**
💰 **PLATA (Lvl ${stats.lvlPlata})** ${stats.xpPlata}/${stats.lvlPlata * 100} XP
🧠 **PENSAR (Lvl ${stats.lvlPensar})** ${stats.xpPensar}/${stats.lvlPensar * 100} XP
💪 **FÍSICO (Lvl ${stats.lvlFisico})** ${stats.xpFisico}/${stats.lvlFisico * 100} XP
❤️ **SOCIAL (Lvl ${stats.lvlSocial})** ${stats.xpSocial}/${stats.lvlSocial * 100} XP
`);
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
            let pilarXP: "PLATA" | "PENSAR" | "FISICO" | "SOCIAL" = "FISICO"; 
            let notaExtra = "";

            switch (evento.type) {
                // --- ADICCIONES ---
                case "addiction_start":
                    const vicioStart = evento.vicio || "Algo";
                    // Check si ya existe
                    const existe = await prisma.addiction.findFirst({ where: { nombre: { contains: vicioStart, mode: 'insensitive' } } });
                    if (!existe) {
                        await prisma.addiction.create({
                            data: { nombre: vicioStart, inicio: new Date(), ultimoRelapso: new Date() }
                        });
                        xpGanada = 50; // XP por la iniciativa
                        notaExtra = " (Iniciativa Detox 🛡️)";
                    } else {
                        notaExtra = " (Ya estabas trackeando esto)";
                    }
                    break;

                case "addiction_relapse":
                    const vicioRelapse = evento.vicio || "";
                    const addiction = await prisma.addiction.findFirst({
                        where: { nombre: { contains: vicioRelapse, mode: 'insensitive' } }
                    });

                    if (addiction) {
                        const ahora = new Date();
                        const diffMs = ahora.getTime() - new Date(addiction.ultimoRelapso).getTime();
                        const horasLimpio = diffMs / (1000 * 60 * 60);
                        const nuevoRecord = Math.max(addiction.recordHoras, horasLimpio);

                        await prisma.addiction.update({
                            where: { id: addiction.id },
                            data: { ultimoRelapso: ahora, recaidas: { increment: 1 }, recordHoras: nuevoRecord }
                        });
                        
                        // Mensaje personalizado de recaída
                        const dias = (horasLimpio / 24).toFixed(1);
                        respuestasArray.push(`⚠️ Recaída registrada en **${addiction.nombre}**.\nDuraste: ${dias} días (${horasLimpio.toFixed(1)}hs).\nRécord histórico: ${(nuevoRecord/24).toFixed(1)} días.\n\n_Contador reseteado a 0. ¡A volver a intentar!_`);
                        continue; // Saltamos la parte de sumar XP standard, la recaída no da XP (o podría restar en el futuro)
                    } else {
                        respuestasArray.push(`No encontré un registro para "${vicioRelapse}". Decime "Quiero dejar ${vicioRelapse}" primero.`);
                        continue;
                    }
                    break;

                // --- RESTO ---
                case "sueno":
                    const horasSueno = evento.horas_sueno || evento.cantidad || 0;
                    pilarXP = "FISICO";
                    if (horasSueno > 7) { xpGanada = 100; notaExtra = " (Recovery Bonus 💤)"; }
                    await prisma.logConsumo.create({ data: { tipo: "SUENO", descripcion: `Sueño ${horasSueno}hs`, cantidad: horasSueno, xpGanada: xpGanada } });
                    break;
                case "ciclo_fin":
                    const ultimo = await prisma.logCiclo.findFirst({ where: { fin: null }, orderBy: { inicio: 'desc' } });
                    if (ultimo) {
                        const ahora = new Date();
                        const duracionHoras = (ahora.getTime() - new Date(ultimo.inicio).getTime()) / (1000 * 60 * 60);
                        pilarXP = ultimo.pilar as any;
                        if (duracionHoras > 2) { xpGanada = 100; notaExtra = " (Deep Work 🔥)"; } 
                        else { xpGanada = 50; }
                        await prisma.logCiclo.update({ where: { id: ultimo.id }, data: { fin: ahora, estado: "COMPLETADO", resultado: evento.resultado, xpGanada: { increment: xpGanada } } });
                    }
                    break;
                case "ejercicio_reps":
                    const reps = evento.reps || 0; pilarXP = "FISICO";
                    if (reps >= 10) { xpGanada = reps; await prisma.logCiclo.create({ data: { tarea: `Reps: ${evento.descripcion}`, pilar: "FISICO", estado: "COMPLETADO", resultado: `${reps} reps`, xpGanada: xpGanada } }); }
                    break;
                case "ayuno":
                    const horasAyuno = evento.horas_ayuno || evento.cantidad || 0; pilarXP = "FISICO";
                    if (horasAyuno >= 12) xpGanada = horasAyuno * 10;
                    await prisma.logConsumo.create({ data: { tipo: "AYUNO", descripcion: `Ayuno ${horasAyuno}hs`, cantidad: horasAyuno, xpGanada: xpGanada } });
                    break;
                case "estado":
                    if (evento.energia || evento.concentracion) { xpGanada = 10; pilarXP = "FISICO"; await prisma.logEstado.create({ data: { energia: evento.energia, concentracion: evento.concentracion, inputUsuario: text, notasIA: evento.resumen, xpGanada: xpGanada } }); }
                    break;
                case "consumo":
                    xpGanada = 10; pilarXP = "FISICO"; await prisma.logConsumo.create({ data: { tipo: evento.clase, descripcion: evento.descripcion, cantidad: evento.cantidad, xpGanada: xpGanada } });
                    break;
                case "ciclo_inicio":
                    xpGanada = 15; pilarXP = evento.pilar; await prisma.logCiclo.create({ data: { tarea: evento.tarea, pilar: evento.pilar, estado: "EN_PROGRESO", xpGanada: xpGanada } });
                    break;
                case "idea":
                    xpGanada = 20; pilarXP = "PENSAR"; await prisma.logIdea.create({ data: { idea: evento.texto || evento.descripcion || text, tags: evento.tags_idea, xpGanada: xpGanada } });
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