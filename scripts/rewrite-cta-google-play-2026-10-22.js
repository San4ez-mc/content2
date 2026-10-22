'use strict';
// Одноразова міграція змісту (2026-10-22): KIRO опубліковано в Google Play, ключовий заклик тепер «завантаж у Google Play за посиланням у
// закріпленому» (факт у content2, topic «пріоритет залучення»). Заплановані пости й сценарії відео ще кличуть «пиши в приват — дам ранній
// доступ»: після релізу це неправда. Скрипт переписує ЛИШЕ відомі дослівні формулювання заклику (регулярками, бо вони продиктовані самим
// менеджером) і лишає без змін усе інше; що не впізнав — друкує на ручну перевірку.
//   node scripts/rewrite-cta-google-play-2026-10-22.js [--dry] [--from=YYYY-MM-DD]
// Чіпає тільки status=scheduled|draft і дати від --from (за замовчуванням сьогодні за Києвом). Для відео — ще й тексти сцен (funnel_params.scenes[].text),
// які «запікаються» в кадри під час рендера: відео, що вже зібрані, цим не змінюються. Idempotent.
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
    const envFile = ['.env', '.env.local', '.env.production'].map((f) => path.join(__dirname, '..', f)).find((f) => fs.existsSync(f));
    if (envFile) for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) { const m = line.match(/^DATABASE_URL=(.*)$/); if (m) process.env.DATABASE_URL = m[1].replace(/^"|"$/g, ''); }
}
const { PrismaClient } = require(path.join(__dirname, '..', 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient();
const dry = process.argv.includes('--dry');
const fromArg = (process.argv.find((a) => a.startsWith('--from=')) || '').slice(7);
const today = fromArg || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const G = 'Завантажуй KIRO в Google Play, посилання в закріпленому';
const D = '\\s*[—-]\\s*';   // тире з пробілами
// порядок важливий: спершу «змішані» (людям + організаторам), потім одиночні
const RULES = [
    [new RegExp('Пиши в приват[,—\\s-]+дам ранній доступ або допоможу (?:розмістити першу подію|з першою публікацією)\\.?', 'g'), G + '. А якщо ти організатор, пиши в приват, допоможу розмістити першу подію.'],
    [new RegExp('Шукаєш куди піти або хочеш розмістити свою подію' + D + 'пиши в приват, дам ранній доступ\\.?', 'g'), 'Шукаєш куди піти? ' + G + '. Хочеш розмістити свою подію? Пиши в приват.'],
    [new RegExp('Шукаєш куди піти\\? Пиши в приват, дам ранній доступ\\.?', 'g'), 'Шукаєш куди піти? ' + G + '.'],
    [new RegExp('Шукаєш подію чи хочеш розмістити свою\\? Пиши в приват, дам ранній доступ або допоможу з першою публікацією\\.?', 'g'), 'Шукаєш подію? ' + G + '. Хочеш розмістити свою? Пиши в приват, допоможу з першою публікацією.'],
    [new RegExp('(розміщу першу(?: подію)?(?: разом із тобою)?) і дам ранній доступ', 'g'), '$1'],
    [new RegExp('Хто на Android' + D + 'пиши в приват, дам ранній доступ', 'g'), 'Хто на Android' + ' — ' + G.charAt(0).toLowerCase() + G.slice(1)],
    [new RegExp('Хочеш потрапити туди першим' + D + 'пиши в приват', 'g'), G],
    [new RegExp('Якщо хочеш потрапити до них' + D + 'пиши в приват, дам ранній доступ', 'g'), 'Якщо хочеш потрапити до них — ' + G.charAt(0).toLowerCase() + G.slice(1)],
    [new RegExp('Якщо це про тебе' + D + 'пиши, дам ранній доступ', 'g'), 'Якщо це про тебе — ' + G.charAt(0).toLowerCase() + G.slice(1)],
    [new RegExp('Якщо хочеш бути серед перших, хто це бачить' + D + 'пиши в приват, дам ранній доступ', 'g'), 'Якщо хочеш це бачити — ' + G.charAt(0).toLowerCase() + G.slice(1)],
    [new RegExp('Пиши в приват' + D + 'приєднуйся зараз', 'g'), G + ' — приєднуйся зараз'],
    [new RegExp('Хочеш ранній доступ\\?\\s*Пиши в приват\\.?', 'g'), G + '.'],
    [new RegExp('Хочеш ранній доступ' + D + 'пиши в приват\\.?', 'g'), G + '.'],
    [new RegExp('Хочеш ранній доступ\\?', 'g'), G + '.'],
    [new RegExp('Напиши мені в приват, дам ранній доступ\\.?', 'g'), G + '.'],
    [new RegExp('Пишеш в приват' + D + 'і отримуєш доступ\\.?', 'g'), G + '.'],
    [new RegExp('Пиши в приват[,—\\s-]+дам ранній доступ(?: до KIRO)?\\.?', 'g'), G + '.'],
    // відео: підпис і тексти сцен
    [new RegExp('(?:Напиши|Пиши) в приват[:,]?\\s*[—-]?\\s*(?:ранній доступ|доступ для Android)\\.?', 'g'), 'Завантажуй у Google Play'],
    [new RegExp('отримай ранній Android-доступ', 'g'), 'завантажуй в Google Play'],
];
const LEFTOVER = /ранн(?:ій|ього|ім) доступ|закрит(?:е|ого|ому) тестуван|тестов(?:ий|ого) період|в приват|у приват/i;

function rewrite(text) {
    let t = String(text || '');
    for (const [re, to] of RULES) t = t.replace(re, to);
    return t;
}

(async () => {
    const items = await prisma.postItem.findMany({
        where: { group: { status: { in: ['scheduled', 'draft'] }, postDate: { gte: new Date(today) } } },
        select: { id: true, content: true, funnelParams: true, group: { select: { number: true, postDate: true, socialNetwork: { select: { platformKey: true } } } } },
    });
    let changed = 0, scenesChanged = 0; const manual = [];
    for (const it of items) {
        const data = {};
        const before = it.content || '';
        const after = rewrite(before);
        if (after !== before) { data.content = after; changed++; }
        else if (LEFTOVER.test(before)) manual.push('#' + it.group.number + ' (' + it.group.socialNetwork.platformKey + '): ' + before.split(/\n/).filter((l) => LEFTOVER.test(l)).join(' | ').slice(0, 200));
        const fp = it.funnelParams && typeof it.funnelParams === 'object' ? JSON.parse(JSON.stringify(it.funnelParams)) : null;
        if (fp && Array.isArray(fp.scenes)) {
            let sc = false;
            for (const s of fp.scenes) {
                if (s && typeof s.text === 'string' && /приват|ранній доступ/i.test(s.text)) { s.text = 'Завантажуй у Google Play'; sc = true; scenesChanged++; }
            }
            if (sc) data.funnelParams = fp;
        }
        if (Object.keys(data).length) {
            if (dry) console.log('#' + it.group.number, it.group.socialNetwork.platformKey, JSON.stringify(Object.keys(data)), '\n   - ' + before.split('\n').filter((l) => LEFTOVER.test(l)).join(' / ').slice(0, 160) + '\n   + ' + after.split('\n').filter((l) => /Google Play/.test(l)).join(' / ').slice(0, 160));
            else await prisma.postItem.update({ where: { id: it.id }, data });
        }
    }
    console.log(JSON.stringify({ today, scanned: items.length, textChanged: changed, scenesChanged, dry }));
    if (manual.length) { console.log('\nПОТРЕБУЮТЬ РУЧНОЇ ПЕРЕВІРКИ (' + manual.length + '):'); manual.forEach((m) => console.log(' ' + m)); }
    await prisma.$disconnect();
    process.exit(0);
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
