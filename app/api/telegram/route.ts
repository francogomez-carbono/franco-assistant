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

// --- LOGICA DE JUEGO ---
// Esta función se usa para calcular el nivel de una cuenta o pilar basado en su XP total
function calcularNivel(xpTotal: number) {
    let nivel = 1;
    let costo = 100;
    let xp = xpTotal;
    while (xp >= costo) {
        xp -= costo;
        nivel++;
        costo = nivel * 100;
    }
    return { nivel, xpRestante: xp, proximoNivel: costo };
}

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

    // Sumamos XP
    currentXP += puntos;
    let mensajeLevelUp = "";

    // Usamos la misma lógica de cálculo
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
🎮 **REGLAS DE JUEGO (PRO)**
🧠 **DEEP WORK:** >2hs = **100 XP**
🛌 **SUEÑO:** >7hs = **100 XP**
💪 **ENTRENAMIENTO:** 1 Rep = 1 XP
⏳ **AYUNO:** 1 Hora = 10 XP
`;

const SYSTEM_PROMPT = `
Rol: Gamemaster y Asistente.
Tarea: Estructurar datos y asignar XP al pilar correcto.
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

    // --- COMANDO /NIVEL CORREGIDO ---
    if (text === "/nivel" || text.toLowerCase().includes("que nivel")) {
        let stats = await prisma.userStats.findFirst();
        if (!stats) stats = await prisma.userStats.create({ data: {} });

        // Calcular Nivel Global Real
        const totalXP = stats.xpPlata + stats.xpPensar + stats.xpFisico + stats.xpSocial;
        const global = calcularNivel(totalXP);

        const barra = (val: number, max: number) => {
            const porcentaje = Math.min(10, Math.floor((val / max) * 10));
            return "🟦".repeat(porcentaje) + "⬜".repeat(10 - porcentaje);
        };

        const msg = `
🏆 **PERFIL DE JUGADOR**
🔥 **Nivel de Cuenta: ${global.nivel}**
✨ XP Total: ${totalXP} (Faltan ${global.proximoNivel - global.xpRestante} para Lvl ${global.nivel + 1})

💰 **PLATA (Lvl ${stats.lvlPlata})**
${barra(stats.xpPlata, stats.lvlPlata * 100)} ${stats.xpPlata}/${stats.lvlPlata * 100}

🧠 **PENSAR (Lvl ${stats.lvlPensar})**
${barra(stats.xpPensar, stats.lvlPensar * 100)} ${stats.xpPensar}/${stats.lvlPensar * 100}

💪 **FÍSICO (Lvl ${stats.lvlFisico})**
${barra(stats.xpFisico, stats.lvlFisico * 100)} ${stats.xpFisico}/${stats.lvlFisico * 100}

❤️ **SOCIAL (Lvl ${stats.lvlSocial})**
${barra(stats.xpSocial, stats.lvlSocial * 100)} ${stats.xpSocial}/${stats.lvlSocial * 100}
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
            let pilarXP: "PLATA" | "PENSAR" | "FISICO" | "SOCIAL" = "FISICO"; 
            let notaExtra = "";

            switch (evento.type) {
                case "sueno":
                    const horasSueno = evento.horas_sueno || evento.cantidad || 0;
                    pilarXP = "FISICO";
                    if (horasSueno > 7) {
                        xpGanada = 100;
                        notaExtra = " (Recovery Bonus 💤)";
                    }
                    await prisma.logConsumo.create({ data: { tipo: "SUENO", descripcion: `Sueño ${horasSueno}hs`, cantidad: horasSueno, xpGanada: xpGanada } });
                    break;
                case "ciclo_fin":
                    const ultimo = await prisma.logCiclo.findFirst({ where: { fin: null }, orderBy: { inicio: 'desc' } });
                    if (ultimo) {
                        const ahora = new Date();
                        const duracionHoras = (ahora.getTime() - new Date(ultimo.inicio).getTime()) / (1000 * 60 * 60);
                        pilarXP = ultimo.pilar as any;
                        if (duracionHoras > 2) {
                            xpGanada = 100;
                            notaExtra = " (Deep Work 🔥)";
                        } else { xpGanada = 50; }
                        await prisma.logCiclo.update({ where: { id: ultimo.id }, data: { fin: ahora, estado: "COMPLETADO", resultado: evento.resultado, xpGanada: { increment: xpGanada } } });
                    }
                    break;
                case "ejercicio_reps":
                    const reps = evento.reps || 0;
                    pilarXP = "FISICO";
                    if (reps >= 10) {
                        xpGanada = reps;
                        await prisma.logCiclo.create({ data: { tarea: `Reps: ${evento.descripcion}`, pilar: "FISICO", estado: "COMPLETADO", resultado: `${reps} reps`, xpGanada: xpGanada } });
                    }
                    break;
                case "ayuno":
                    const horasAyuno = evento.horas_ayuno || evento.cantidad || 0;
                    pilarXP = "FISICO";
                    if (horasAyuno >= 12) xpGanada = horasAyuno * 10;
                    await prisma.logConsumo.create({ data: { tipo: "AYUNO", descripcion: `Ayuno ${horasAyuno}hs`, cantidad: horasAyuno, xpGanada: xpGanada } });
                    break;
                case "estado":
                    if (evento.energia || evento.concentracion) {
                        xpGanada = 10; pilarXP = "FISICO";
                        await prisma.logEstado.create({ data: { energia: evento.energia, concentracion: evento.concentracion, inputUsuario: text, notasIA: evento.resumen, xpGanada: xpGanada } });
                    }
                    break;
                case "consumo":
                    xpGanada = 10; pilarXP = "FISICO";
                    await prisma.logConsumo.create({ data: { tipo: evento.clase, descripcion: evento.descripcion, cantidad: evento.cantidad, xpGanada: xpGanada } });
                    break;
                case "ciclo_inicio":
                    xpGanada = 15; pilarXP = evento.pilar;
                    await prisma.logCiclo.create({ data: { tarea: evento.tarea, pilar: evento.pilar, estado: "EN_PROGRESO", xpGanada: xpGanada } });
                    break;
                case "idea":
                    xpGanada = 20; pilarXP = "PENSAR";
                    await prisma.logIdea.create({ data: { idea: evento.texto || evento.descripcion || text, tags: evento.tags_idea, xpGanada: xpGanada } });
                    break;
            }

            let suffixXP = "";
            if (xpGanada > 0) {
                const resultadoXP = await sumarXP(xpGanada, pilarXP);
                suffixXP = ` _${resultadoXP.msg}${notaExtra}_`;
            }
            if (evento.reply) respuestasArray.push(`${evento.reply}${suffixXP}`);
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