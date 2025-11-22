import { Bot, webhookCallback } from "grammy";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const token = process.env.TELEGRAM_TOKEN;
const bot = token ? new Bot(token) : null;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- 0. HELPER: OBTENER USUARIO ---
async function getUser(ctx: any) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return null;

    let user = await prisma.user.findUnique({
        where: { telegramId },
        include: { stats: true }
    });

    if (!user) {
        // Crear usuario y sus stats iniciales
        user = await prisma.user.create({
            data: {
                telegramId,
                stats: {
                    create: {} // Crea stats default (Lvl 1, 0 XP)
                }
            },
            include: { stats: true }
        });
    }
    return user;
}

// --- 1. FUNCIÓN: RECUPERAR HISTORIA (DATA MINING) ---
async function getHistoryForAnalysis(userId: string) {
    const hace7dias = new Date();
    hace7dias.setDate(hace7dias.getDate() - 7);

    // Filtramos por userId para no mezclar datos
    const [consumos, ciclos, estados] = await Promise.all([
        prisma.logConsumo.findMany({ 
            where: { userId, timestamp: { gte: hace7dias } }, 
            orderBy: { timestamp: 'asc' } 
        }),
        prisma.logCiclo.findMany({ 
            where: { userId, inicio: { gte: hace7dias } },
            orderBy: { inicio: 'asc' }
        }),
        prisma.logEstado.findMany({ 
            where: { userId, timestamp: { gte: hace7dias } },
            orderBy: { timestamp: 'asc' }
        })
    ]);

    let reporte = "--- REGISTRO DE LOS ÚLTIMOS 7 DÍAS ---\n";
    
    const logsUnificados = [
        ...consumos.map(c => ({ fecha: c.timestamp, txt: `CONSUMO: ${c.descripcion} (${c.cantidad || '?'} ${c.tipo})` })),
        ...ciclos.map(c => ({ fecha: c.inicio, txt: `ACTIVIDAD: ${c.tarea} (${c.pilar}) [Estado: ${c.estado}]` })),
        ...estados.map(e => ({ fecha: e.timestamp, txt: `ESTADO: Energía ${e.energia}/5, Foco ${e.concentracion}/5. Nota: ${e.notasIA}` }))
    ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    logsUnificados.forEach(log => {
        const fechaStr = log.fecha.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', hour: 'numeric' });
        reporte += `[${fechaStr}] ${log.txt}\n`;
    });

    return reporte;
}

// --- 2. SISTEMA XP ---
async function sumarXP(userId: string, puntos: number, pilar: "PLATA" | "PENSAR" | "FISICO" | "SOCIAL") {
    // Buscamos stats por userId
    let stats = await prisma.userStats.findUnique({ where: { userId } });
    if (!stats) return { msg: "" }; // Should not happen

    const map = {
        "PLATA": { xp: "xpPlata", lvl: "lvlPlata" },
        "PENSAR": { xp: "xpPensar", lvl: "lvlPensar" },
        "FISICO": { xp: "xpFisico", lvl: "lvlFisico" },
        "SOCIAL": { xp: "xpSocial", lvl: "lvlSocial" }
    };
    
    // TypeScript trickery para acceder dinámicamente
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
        where: { userId },
        data: { [campoXP]: currentXP, [campoLvl]: currentLvl }
    });
    
    return { msg: `(+${puntos} XP ${pilar})${mensajeLevelUp}` };
}

const MENSAJE_AYUDA = `
🧠 **COMANDOS INTELIGENTES**
• /insights [pregunta] - Analiza tus datos y busca patrones.
  Ej: _"/insights ¿Por qué estuve cansado ayer?"_

🎮 **REGLAS XP**
🧠 **DEEP WORK:** >2hs = **100 XP**
🛌 **SUEÑO:** >7hs = **100 XP**
💪 **ENTRENAMIENTO:** 1 Rep = 1 XP
⏳ **AYUNO:** 1 Hora = 10 XP
`;

// En app/api/telegram/route.ts

const SYSTEM_PROMPT_LOGGER = `
Rol: Gamemaster y Asistente.
Tarea: Estructurar datos y asignar XP.

REGLAS CRÍTICAS DE CÁLCULO:
1. ENTRENAMIENTO: Si el usuario menciona SERIES y REPETICIONES (ej: "4 series de 12", "4x12", "3 vueltas de 15"), DEBES MULTIPLICAR (ej: 4 * 12 = 48) y poner el TOTAL en el campo 'reps'.
2. DESCRIPTION: En el campo 'descripcion', mantén el detalle original (ej: "Press Pecho 4x12").

JSON (Strict):
{
  "events": [
    {
      "type": "estado"|"consumo"|"ciclo_inicio"|"ciclo_fin"|"idea"|"ejercicio_reps"|"ayuno"|"sueno"|"nota"|"addiction_start"|"addiction_relapse"|"social",
      "reply": "Confirmación empática y corta",
      "energia": 1-5, "concentracion": 1-5, "resumen": "txt",
      "clase": "COMIDA"|"LIQUIDO"|"AYUNO"|"SUENO", "descripcion": "txt", "cantidad": number,
      "tarea": "txt", "pilar": "PLATA"|"PENSAR"|"FISICO"|"SOCIAL",
      "resultado": "txt", "texto": "txt", "tags_idea": "txt",
      "reps": number, "horas_ayuno": number, "horas_sueno": number, "vicio": "txt",
      "persona": "txt", "duracion_social": number, "valoracion_social": 1-5
    }
  ]
}
`;

const SYSTEM_PROMPT_ANALYST = `
Eres el ANALISTA DE DATOS PERSONALES.
Tu objetivo: Encontrar correlaciones Causa-Efecto en sus registros de la última semana.
TAREA:
- Analiza los datos buscando patrones (Ej: "Comió harina -> Energía bajó").
- Responde DIRECTAMENTE a la pregunta usando evidencia de los logs.
- Sé breve.
`;

const handleMessage = async (ctx: any) => {
    if (!ctx.message?.text) return;
    
    // 1. Identificar Usuario
    const user = await getUser(ctx);
    if (!user) {
        await ctx.reply("Error identificando usuario.");
        return;
    }
    const userId = user.id;
    const text = ctx.message.text;

    // --- COMANDO INSIGHTS ---
    if (text.startsWith("/insights")) {
        const pregunta = text.replace("/insights", "").trim();
        if (!pregunta) {
            await ctx.reply("🤔 Decime qué querés saber. Ej: `/insights ¿Qué día fui más productivo?`", {parse_mode: "Markdown"});
            return;
        }

        await ctx.reply("🧐 Analizando tus registros de la semana...");
        await bot?.api.sendChatAction(ctx.chat.id, "typing");

        try {
            const historial = await getHistoryForAnalysis(userId);
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT_ANALYST },
                    { role: "user", content: `HISTORIAL:\n${historial}\n\nPREGUNTA: ${pregunta}` }
                ],
                temperature: 0.7,
            });
            const respuesta = completion.choices[0].message.content;
            await ctx.reply(respuesta || "No pude generar un análisis.");
        } catch (e) {
            console.error(e);
            await ctx.reply("⚠️ Error analizando datos.");
        }
        return;
    }

    // --- COMANDOS PERFIL ---
    if (text === "/nivel" || text.toLowerCase().includes("que nivel")) {
        const stats = user.stats!; // Ya lo incluimos en getUser
        const barra = (val: number, max: number) => "🟦".repeat(Math.min(10, Math.floor((val / max) * 10))) + "⬜".repeat(10 - Math.min(10, Math.floor((val / max) * 10)));
        
        await ctx.reply(`
🏆 **PERFIL**
💰 PLATA (Lvl ${stats.lvlPlata}) ${barra(stats.xpPlata, stats.lvlPlata * 100)}
🧠 PENSAR (Lvl ${stats.lvlPensar}) ${barra(stats.xpPensar, stats.lvlPensar * 100)}
💪 FÍSICO (Lvl ${stats.lvlFisico}) ${barra(stats.xpFisico, stats.lvlFisico * 100)}
❤️ SOCIAL (Lvl ${stats.lvlSocial}) ${barra(stats.xpSocial, stats.lvlSocial * 100)}
`);
        return;
    }

    if (text === "/comandos" || text === "/ayuda") {
        await ctx.reply(MENSAJE_AYUDA, { parse_mode: "Markdown" });
        return;
    }

    // --- PROCESAMIENTO REGISTRO (IA) ---
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: SYSTEM_PROMPT_LOGGER }, { role: "user", content: text }],
            temperature: 0.5, max_tokens: 400, response_format: { type: "json_object" }
        });

        const raw = completion.choices[0].message.content || "{}";
        const data = JSON.parse(raw);
        const eventos = data.events || [data]; 
        let respuestasArray: string[] = [];

        for (const evento of eventos) {
            let xpGanada = 0;
            let pilarXP: "PLATA" | "PENSAR" | "FISICO" | "SOCIAL" = "FISICO"; 
            let notaExtra = "";

            switch (evento.type) {
                case "addiction_start":
                    const vicioStart = evento.vicio || "Algo";
                    const existe = await prisma.addiction.findFirst({ where: { userId, nombre: { contains: vicioStart, mode: 'insensitive' } } });
                    if (!existe) {
                        await prisma.addiction.create({ data: { userId, nombre: vicioStart, inicio: new Date(), ultimoRelapso: new Date() } });
                        xpGanada = 50; notaExtra = " (Detox Start 🛡️)";
                    }
                    break;
                case "addiction_relapse":
                    const vicioRelapse = evento.vicio || "";
                    const addiction = await prisma.addiction.findFirst({ where: { userId, nombre: { contains: vicioRelapse, mode: 'insensitive' } } });
                    if (addiction) {
                        const ahora = new Date();
                        const diffMs = ahora.getTime() - new Date(addiction.ultimoRelapso).getTime();
                        const horasLimpio = diffMs / (1000 * 60 * 60);
                        const nuevoRecord = Math.max(addiction.recordHoras, horasLimpio);
                        await prisma.addiction.update({ where: { id: addiction.id }, data: { ultimoRelapso: ahora, recaidas: { increment: 1 }, recordHoras: nuevoRecord } });
                        respuestasArray.push(`⚠️ Recaída en **${addiction.nombre}**. Duraste: ${(horasLimpio/24).toFixed(1)}d. Récord: ${(nuevoRecord/24).toFixed(1)}d.`);
                        continue;
                    }
                    break;
                case "sueno":
                    const horasSueno = evento.horas_sueno || evento.cantidad || 0; pilarXP = "FISICO";
                    if (horasSueno > 7) { xpGanada = 100; notaExtra = " (Recovery Bonus 💤)"; }
                    await prisma.logConsumo.create({ data: { userId, tipo: "SUENO", descripcion: `Sueño ${horasSueno}hs`, cantidad: horasSueno, xpGanada: xpGanada } });
                    break;
                case "ciclo_fin":
                    const ultimo = await prisma.logCiclo.findFirst({ where: { userId, fin: null }, orderBy: { inicio: 'desc' } });
                    if (ultimo) {
                        const ahora = new Date();
                        const duracionHoras = (ahora.getTime() - new Date(ultimo.inicio).getTime()) / (1000 * 60 * 60);
                        pilarXP = ultimo.pilar as any;
                        if (duracionHoras > 2) { xpGanada = 100; notaExtra = " (Deep Work 🔥)"; } else { xpGanada = 50; }
                        await prisma.logCiclo.update({ where: { id: ultimo.id }, data: { fin: ahora, estado: "COMPLETADO", resultado: evento.resultado, xpGanada: { increment: xpGanada } } });
                    }
                    break;
                case "ejercicio_reps":
                    const reps = evento.reps || 0; pilarXP = "FISICO";
                    if (reps >= 1) { xpGanada = reps; await prisma.logCiclo.create({ data: { userId, tarea: `Reps: ${evento.descripcion}`, pilar: "FISICO", estado: "COMPLETADO", resultado: `${reps} reps`, xpGanada: xpGanada } }); }
                    break;
                case "ayuno":
                    const horasAyuno = evento.horas_ayuno || evento.cantidad || 0; pilarXP = "FISICO";
                    if (horasAyuno >= 12) xpGanada = horasAyuno * 10;
                    await prisma.logConsumo.create({ data: { userId, tipo: "AYUNO", descripcion: `Ayuno ${horasAyuno}hs`, cantidad: horasAyuno, xpGanada: xpGanada } });
                    break;
                case "estado":
                    if (evento.energia || evento.concentracion) { xpGanada = 10; pilarXP = "FISICO"; await prisma.logEstado.create({ data: { userId, energia: evento.energia, concentracion: evento.concentracion, inputUsuario: text, notasIA: evento.resumen, xpGanada: xpGanada } }); }
                    break;
                case "consumo":
                    xpGanada = 10; pilarXP = "FISICO"; await prisma.logConsumo.create({ data: { userId, tipo: evento.clase, descripcion: evento.descripcion, cantidad: evento.cantidad, xpGanada: xpGanada } });
                    break;
                case "ciclo_inicio":
                    xpGanada = 15; pilarXP = evento.pilar || "PENSAR"; await prisma.logCiclo.create({ data: { userId, tarea: evento.tarea, pilar: evento.pilar, estado: "EN_PROGRESO", xpGanada: xpGanada } });
                    break;
                case "idea":
                    xpGanada = 20; pilarXP = "PENSAR"; await prisma.logIdea.create({ data: { userId, idea: evento.texto || evento.descripcion || text, tags: evento.tags_idea, xpGanada: xpGanada } });
                    break;
                case "social":
                    xpGanada = 30; pilarXP = "SOCIAL"; await prisma.logSocial.create({ data: { userId, tipo: "Interacción", persona: evento.persona, duracion: evento.duracion_social, valoracion: evento.valoracion_social, xpGanada: xpGanada }});
                    break;
            }

            let suffixXP = "";
            if (xpGanada > 0) {
                const resultadoXP = await sumarXP(userId, xpGanada, pilarXP);
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