import { Bot } from "grammy";
import { PrismaClient } from "@prisma/client";

export const dynamic = 'force-dynamic';

const token = process.env.TELEGRAM_TOKEN;
const userId = process.env.TELEGRAM_USER_ID;
const bot = token ? new Bot(token) : null;
const prisma = new PrismaClient();

export async function GET() {
    if (!bot || !userId) return Response.json({ error: "Faltan credenciales" });

    try {
        // 1. Definir el rango de tiempo (El día de hoy)
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // 2. Buscar actividad en los logs de hoy
        const logsHoy = await prisma.logCiclo.findMany({
            where: { inicio: { gte: startOfDay, lte: endOfDay } }
        });
        const consumosHoy = await prisma.logConsumo.findMany({
            where: { timestamp: { gte: startOfDay, lte: endOfDay } }
        });
        const estadosHoy = await prisma.logEstado.findMany({
            where: { timestamp: { gte: startOfDay, lte: endOfDay } }
        });

        // 3. Determinar si se activó cada pilar hoy (Booleanos)
        const activoFisico = 
            logsHoy.some(l => l.pilar === "FISICO") || 
            consumosHoy.some(c => (c.tipo as string) === "AYUNO" || (c.tipo as string) === "SUENO" || (c.xpGanada > 0 && (c.tipo as string) !== "AYUNO"));
        
        const activoPlata = logsHoy.some(l => l.pilar === "PLATA");
        const activoPensar = logsHoy.some(l => l.pilar === "PENSAR") || logsHoy.some(l => l.pilar === "PLATA"); // A veces plata implica pensar
        const activoSocial = logsHoy.some(l => l.pilar === "SOCIAL"); // O si registraste algo manual

        // 4. Obtener Stats actuales
        let stats = await prisma.userStats.findFirst();
        if (!stats) return Response.json({ error: "No stats found" });

        let mensajeReporte = "🌙 **CIERRE DEL DÍA**\n\n";
        let castigoAplicado = false;

        // --- LÓGICA DE RACHAS Y CASTIGOS ---

        // A. PILAR FÍSICO (El más importante según tus reglas)
        if (activoFisico) {
            stats.rachaFisico += 1;
            mensajeReporte += `💪 Físico: Cumplido (Racha: ${stats.rachaFisico} días)\n`;
        } else {
            // CASTIGO: -25 XP a TODO si fallás físico
            stats.rachaFisico = 0;
            stats.xpFisico = Math.max(0, stats.xpFisico - 25);
            stats.xpPlata = Math.max(0, stats.xpPlata - 25);
            stats.xpPensar = Math.max(0, stats.xpPensar - 25);
            stats.xpSocial = Math.max(0, stats.xpSocial - 25);
            
            mensajeReporte += `💀 **FÍSICO FALLADO:** Racha a 0.\n⚠️ **CASTIGO:** -25 XP en TODOS los pilares.\n`;
            castigoAplicado = true;
        }

        // B. OTROS PILARES (Solo manejo de racha simple por ahora)
        if (activoPlata) {
            stats.rachaPlata += 1;
            mensajeReporte += `💰 Plata: Cumplido (Racha: ${stats.rachaPlata})\n`;
        } else {
            stats.rachaPlata = 0; // Solo pierde racha
        }

        if (activoPensar) {
            stats.rachaPensar += 1;
            mensajeReporte += `🧠 Pensar: Cumplido (Racha: ${stats.rachaPensar})\n`;
        } else {
            stats.rachaPensar = 0;
        }

        // 5. Guardar cambios en DB
        await prisma.userStats.update({
            where: { id: stats.id },
            data: {
                rachaFisico: stats.rachaFisico, xpFisico: stats.xpFisico,
                rachaPlata: stats.rachaPlata, xpPlata: stats.xpPlata,
                rachaPensar: stats.rachaPensar, xpPensar: stats.xpPensar,
                xpSocial: stats.xpSocial // Actualizamos por si hubo castigo
            }
        });

        // 6. Enviar Reporte a Telegram
        const fraseFinal = castigoAplicado 
            ? "\nMañana a recuperar lo perdido. ¡No aflojes!" 
            : "\n¡Excelente día! Seguí así. 🚀";

        await bot.api.sendMessage(userId, mensajeReporte + fraseFinal, { parse_mode: "Markdown" });

        return Response.json({ success: true, reporte: mensajeReporte });

    } catch (error) {
        console.error(error);
        return Response.json({ error: "Falló el cron" }, { status: 500 });
    }
}