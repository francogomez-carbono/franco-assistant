import { Bot, webhookCallback } from "grammy";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

export const dynamic = 'force-dynamic';
// Aumentamos el timeout para que le de tiempo a pensar el análisis
export const maxDuration = 60;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const token = process.env.TELEGRAM_TOKEN;
const bot = token ? new Bot(token) : null;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- 1. FUNCIÓN: RECUPERAR HISTORIA (DATA MINING) ---
async function getHistoryForAnalysis() {
    const hace7dias = new Date();
    hace7dias.setDate(hace7dias.getDate() - 7);

    // Buscamos TODO lo relevante de la semana
    const [consumos, ciclos, estados] = await Promise.all([
        prisma.logConsumo.findMany({ 
            where: { timestamp: { gte: hace7dias } }, 
            orderBy: { timestamp: 'asc' } 
        }),
        prisma.logCiclo.findMany({ 
            where: { inicio: { gte: hace7dias } },
            orderBy: { inicio: 'asc' }
        }),
        prisma.logEstado.findMany({ 
            where: { timestamp: { gte: hace7dias } },
            orderBy: { timestamp: 'asc' }
        })
    ]);

    // Formateamos en texto plano para que la IA lo lea fácil
    let reporte = "--- REGISTRO DE LOS ÚLTIMOS 7 DÍAS ---\n";
    
    // Agrupamos por fecha simple (DD/MM) para que vea la correlación diaria
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
async function sumarXP(puntos: number, pilar: "PLATA" | "PENSAR" | "FISICO" | "SOCIAL") {
    let stats = await prisma.userStats.findFirst();
    if (!stats) stats = await prisma.userStats.create({ data: {} });

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

// Prompt para cuando solo registra datos
const SYSTEM_PROMPT_LOGGER = `
Rol: Gamemaster y Asistente.
Tarea: Estructurar datos y asignar XP.
JSON (Strict):
{
  "events": [
    {
      "type": "estado"|"consumo"|"ciclo_inicio"|"ciclo_fin"|"idea"|"ejercicio_reps"|"ayuno"|"sueno"|"nota"|"addiction_start"|"addiction_relapse",
      "reply": "Confirmación empática",
      "energia": 1-5, "concentracion": 1-5, "resumen": "txt",
      "clase": "COMIDA"|"LIQUIDO"|"AYUNO"|"SUENO", "descripcion": "txt", "cantidad": number,
      "tarea": "txt", "pilar": "PLATA"|"PENSAR"|"FISICO"|"SOCIAL",
      "resultado": "txt", "texto": "txt", "tags_idea": "txt",
      "reps": number, "horas_ayuno": number, "horas_sueno": number, "vicio": "txt"
    }
  ]
}
`;

// Prompt para cuando pide INSIGHTS (Análisis)
const SYSTEM_PROMPT_ANALYST = `
Eres el ANALISTA DE DATOS PERSONALES de Franco.
Tu objetivo: Encontrar correlaciones Causa-Efecto en sus registros de la última semana.

INPUT:
1. Historial cronológico de consumo, sueño, trabajo y estado de ánimo.
2. Pregunta específica del usuario.

TAREA:
- Analiza los datos buscando patrones (Ej: "Comió harina -> Energía bajó", "Durmió poco -> Foco bajo").
- Responde DIRECTAMENTE a la pregunta usando evidencia de los logs.
- Sé breve, analítico pero constructivo.
- Si no hay datos suficientes, dilo claramente.
- NO inventes datos que no están en el log.
`;

const handleMessage = async (ctx: any) => {
    if (!ctx.message.text) return;
    const text = ctx.message.text;

    // --- COMANDO INSIGHTS (NUEVO) ---
    if (text.startsWith("/insights")) {
        const pregunta = text.replace("/insights", "").trim();
        if (!pregunta) {
            await ctx.reply("🤔 Decime qué querés saber. Ej: `/insights ¿Qué día fui más productivo?`", {parse_mode: "Markdown"});
            return;
        }

        await ctx.reply("🧐 Analizando tus registros de la semana...");
        await bot?.api.sendChatAction(ctx.chat.id, "typing");

        try {
            // 1. Traer datos
            const historial = await getHistoryForAnalysis();
            
            // 2. Preguntar a la IA Analista
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

    // --- COMANDOS ESTÁNDAR ---
    if (text === "/nivel" || text.toLowerCase().includes("que nivel")) {
        let stats = await prisma.userStats.findFirst();
        if (!stats) stats = await prisma.userStats.create({ data: {} });
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

    // --- PROCESAMIENTO REGISTRO ---
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: SYSTEM_PROMPT_LOGGER }, { role: "user", content: text }],
            temperature: 0.5, max_tokens: 400, response_format: { type: "json_object" }
        });

        const raw = completion.choices[0].message.content || "{}";
        const firstBrace = raw.indexOf('{');
        const lastBrace = raw.lastIndexOf('}');
        let data = (firstBrace !== -1 && lastBrace !== -1) ? JSON.parse(raw.substring(firstBrace, lastBrace + 1)) : JSON.parse(raw);

        const eventos = data.events || [data]; 
        let respuestasArray: string[] = [];

        for (const evento of eventos) {
            let xpGanada = 0;
            let pilarXP: "PLATA" | "PENSAR" | "FISICO" | "SOCIAL" = "FISICO"; 
            let notaExtra = "";

            switch (evento.type) {
                // (Copiar lógica de switch anterior... ADICCIONES, SUEÑO, ETC)
                case "addiction_start":
                    const vicioStart = evento.vicio || "Algo";
                    const existe = await prisma.addiction.findFirst({ where: { nombre: { contains: vicioStart, mode: 'insensitive' } } });
                    if (!existe) {
                        await prisma.addiction.create({ data: { nombre: vicioStart, inicio: new Date(), ultimoRelapso: new Date() } });
                        xpGanada = 50; notaExtra = " (Detox Start 🛡️)";
                    }
                    break;
                case "addiction_relapse":
                    const vicioRelapse = evento.vicio || "";
                    const addiction = await prisma.addiction.findFirst({ where: { nombre: { contains: vicioRelapse, mode: 'insensitive' } } });
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
                    await prisma.logConsumo.create({ data: { tipo: "SUENO", descripcion: `Sueño ${horasSueno}hs`, cantidad: horasSueno, xpGanada: xpGanada } });
                    break;
                case "ciclo_fin":
                    const ultimo = await prisma.logCiclo.findFirst({ where: { fin: null }, orderBy: { inicio: 'desc' } });
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