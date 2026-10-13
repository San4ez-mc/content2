'use strict';
// Вирівнює schedule_time запланованих постів мереж з автопублікацією (post_directly): рівномірно розкидає пости кожного дня
// по годинах 08:00–21:00 (зсув початку по днях, щоб день у день не збігалося) і заповнює порожні часи.
// Навіщо (2026-10-14): менеджер ставив усім постам дня 12:00, а для частини взагалі лишав порожнім — такі пости планувальник
// НЕ публікує (час поста = момент публікації; без часу withinWindow завжди false). Планувальник працює щогодини о :03,
// тому часи — лише рівні години (HH:00).
//   node scripts/normalize-schedule-times.js [--dry] [--fix-only] [--from=YYYY-MM-DD]
//   --fix-only: НЕ чіпає вже виставлені унікальні часи (їх міг поставити власник вручну), лише заповнює порожні й розводить дублікати в межах дня.
// Чіпає тільки status=scheduled і лише дати від --from (за замовчуванням сьогодні за Києвом). Idempotent.
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
    const envFile = ['.env', '.env.local', '.env.production'].map((f) => path.join(__dirname, '..', f)).find((f) => fs.existsSync(f));
    if (envFile) for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) { const m = line.match(/^DATABASE_URL=(.*)$/); if (m) process.env.DATABASE_URL = m[1].replace(/^"|"$/g, ''); }
}
const { PrismaClient } = require(path.join(__dirname, '..', 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient();

const dry = process.argv.includes('--dry');
const fixOnly = process.argv.includes('--fix-only');
const PREFERRED = [9, 12, 15, 18, 20, 10, 13, 16, 19, 11, 14, 17, 21, 8];
const fromArg = (process.argv.find((a) => a.startsWith('--from=')) || '').slice(7);
const today = fromArg || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function hoursFor(n, dayIdx) {
    if (n <= 1) return [12];
    const start = 8 + (dayIdx % 3);          // 8, 9, 10
    const end = 19 + (dayIdx % 3);           // 19, 20, 21
    const out = [];
    for (let i = 0; i < n; i++) out.push(Math.round(start + ((end - start) * i) / (n - 1)));
    for (let i = 1; i < out.length; i++) if (out[i] <= out[i - 1]) out[i] = Math.min(21, out[i - 1] + 1);   // унікальні години
    return out;
}

(async () => {
    const nets = await prisma.socialNetwork.findMany({ where: { isEnabled: true, postDirectly: true }, select: { id: true, name: true, projectId: true } });
    let changed = 0, days = 0;
    for (const net of nets) {
        const posts = await prisma.postGroup.findMany({
            where: { socialNetworkId: net.id, status: 'scheduled', postDate: { gte: new Date(today) } },
            select: { id: true, number: true, postDate: true, scheduleTime: true },
            orderBy: [{ postDate: 'asc' }, { number: 'asc' }],
        });
        const byDay = new Map();
        for (const p of posts) { const k = p.postDate.toISOString().slice(0, 10); (byDay.get(k) || byDay.set(k, []).get(k)).push(p); }
        let dayIdx = 0;
        for (const [day, list] of byDay) {
            if (fixOnly) {
                days++;
                const used = new Set();
                const todo = [];
                for (const p of list) { if (p.scheduleTime && /^\d{2}:00$/.test(p.scheduleTime) && !used.has(p.scheduleTime)) used.add(p.scheduleTime); else todo.push(p); }
                for (const p of todo) {
                    const h = PREFERRED.find((x) => !used.has(String(x).padStart(2, '0') + ':00'));
                    if (h == null) continue;
                    const t = String(h).padStart(2, '0') + ':00';
                    used.add(t);
                    if (!dry) await prisma.postGroup.update({ where: { id: p.id }, data: { scheduleTime: t } });
                    changed++;
                    if (dry) console.log(net.name, day, '#' + p.number, (p.scheduleTime || '(порожньо)') + ' →', t);
                }
                continue;
            }
            const hrs = hoursFor(list.length, dayIdx++);
            days++;
            for (let i = 0; i < list.length; i++) {
                const t = String(hrs[i]).padStart(2, '0') + ':00';
                if (list[i].scheduleTime === t) continue;
                if (!dry) await prisma.postGroup.update({ where: { id: list[i].id }, data: { scheduleTime: t } });
                changed++;
            }
            if (dry) console.log(net.name, day, list.length, 'постів →', hrs.map((h) => String(h).padStart(2, '0') + ':00').join(' '));
        }
    }
    console.log(JSON.stringify({ today, networks: nets.length, days, changed, dry }));
    await prisma.$disconnect();
    process.exit(0);
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
