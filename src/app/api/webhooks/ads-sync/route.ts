import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AD_PLATFORM_KEY } from "@/lib/adRules";
import { planAdsOrder } from "@/lib/adsOrder";

// Платформа реклами (ads.fineko.space) ↔ контент-платформа. Один вхід, п'ять дій:
//   ping                          — перевірка ключа, назва проєкту й кількість персон/креативів
//   personas                      — персони (аудиторії) проєкту
//   upsert_persona                — створити або оновити персону (аудиторія, створена на платформі реклами)
//   creatives                     — рекламні креативи проєкту (мережа meta_ads): текст, картинка/відео, статус
//   order                         — замовити креативи. Рекламне замовлення (за текстом або kind:"creatives") іде у воронки реклами
//                                   ads-creative-image/-photo/-video (необовʼязкові поля: count, aspects, angles, pains, photoUrls, note, landingUrl, date, render);
//                                   інше повідомлення, як і раніше, контент-менеджеру (чат content2). route:"chat" примусово лишає шлях через чат
//   learning                      — записати підсумок тесту зв'язки в базу знань проєкту (контент-менеджер бачить, що працює)
// Вхід: Authorization: Bearer <ADS_SYNC_KEY>. Окремий ключ лише для цього входу, не системний WEBHOOK_SECRET.
// Без заданого ADS_SYNC_KEY вхід закритий. Нічого не видаляє.
export const dynamic = "force-dynamic";

const FLOWS_BASE = "https://flows.fineko.space/webhook/bot";
const FLOWS_CM = `${FLOWS_BASE}/content-manager-web`;
const clamp = (v: unknown, n: number) => (v === undefined || v === null ? null : String(v).trim().slice(0, n) || null);

function authorized(req: NextRequest): boolean {
  const key = process.env.ADS_SYNC_KEY || "";
  if (!key) return false;
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || "");
  const given = Buffer.from(m ? m[1].trim() : "");
  const want = Buffer.from(key);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

const abs = (p: string | null) => (!p ? null : /^https?:/i.test(p) ? p : `${(process.env.NEXTAUTH_URL || "").replace(/\/$/, "")}${p.startsWith("/") ? "" : "/"}${p}`);

export async function POST(req: NextRequest) {
  if (!process.env.ADS_SYNC_KEY) return NextResponse.json({ ok: false, error: { code: "DISABLED", message: "ADS_SYNC_KEY не задано" } }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ ok: false, error: { code: "AUTH_ERROR", message: "Невірний ключ" } }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as any;
  const action = String(b.action || "");
  const projectId = String(b.projectId || "");
  const fail = (code: string, message: string, status = 400) => NextResponse.json({ ok: false, error: { code, message } }, { status });
  if (!projectId) return fail("VALIDATION_ERROR", "projectId обовʼязковий");
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, isActive: true } });
  if (!project) return fail("NOT_FOUND", "Проєкт не знайдено", 404);

  if (action === "ping") {
    const [personas, creatives] = await Promise.all([
      prisma.persona.count({ where: { projectId } }),
      prisma.postGroup.count({ where: { projectId, socialNetwork: { platformKey: AD_PLATFORM_KEY } } }),
    ]);
    return NextResponse.json({ ok: true, data: { project: project.name, personas, creatives } });
  }

  if (action === "personas") {
    const rows = await prisma.persona.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ ok: true, data: { personas: rows.map((p) => ({ id: p.id, name: p.name, age: p.age, gender: p.gender, pains: p.pains, goals: p.goals, triggers: p.triggers, objections: p.objections, language: p.language })) } });
  }

  if (action === "upsert_persona") {
    const name = clamp(b.name, 200);
    if (!name) return fail("VALIDATION_ERROR", "name обовʼязкове");
    const data = { name, pains: clamp(b.pains, 4000), goals: clamp(b.goals, 4000), triggers: clamp(b.triggers, 4000), objections: clamp(b.objections, 4000), language: clamp(b.language, 4000) };
    if (b.personaId) {
      const cur = await prisma.persona.findFirst({ where: { id: String(b.personaId), projectId } });
      if (!cur) return fail("NOT_FOUND", "Персону не знайдено", 404);
      // Не затираємо наявні поля порожнім: оновлюємо лише те, що прийшло.
      const patch: Record<string, string> = {};
      for (const [k, v] of Object.entries(data)) if (v) patch[k] = v as string;
      const p = await prisma.persona.update({ where: { id: cur.id }, data: patch });
      return NextResponse.json({ ok: true, data: { id: p.id, created: false } });
    }
    const dup = await prisma.persona.findFirst({ where: { projectId, name: { equals: name, mode: "insensitive" } } });
    if (dup) return NextResponse.json({ ok: true, data: { id: dup.id, created: false } });
    const p = await prisma.persona.create({ data: { projectId, ...data } });
    return NextResponse.json({ ok: true, data: { id: p.id, created: true } });
  }

  if (action === "creatives") {
    const take = Math.max(1, Math.min(200, Number(b.limit) || 60));
    const groups = await prisma.postGroup.findMany({
      where: { projectId, socialNetwork: { platformKey: AD_PLATFORM_KEY } },
      orderBy: { createdAt: "desc" }, take,
      include: { items: { orderBy: { orderIndex: "asc" } }, persona: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ ok: true, data: { creatives: groups.map((g) => {
      const first: any = g.items[0] || {};
      const media = abs(first.imagePath || null);
      const isVideo = !!media && /\.(mp4|mov|webm)(\?|$)/i.test(media);
      return {
        id: g.id, number: g.number, status: g.status, formatKey: g.formatKey, topic: g.topic, hook: g.hookSelected === "B" ? g.hookB : g.hookA, cta: g.cta,
        persona: g.persona, createdAt: g.createdAt,
        text: first.content || null, mediaUrl: media, mediaType: media ? (isVideo ? "video" : "image") : null, generationStatus: first.generationStatus || null,
        violations: (first.funnelParams && (first.funnelParams as any).adViolations) || null,
        items: g.items.length,
      };
    }) } });
  }

  if (action === "order") {
    const text = clamp(b.text, 4000);
    if (!text) return fail("VALIDATION_ERROR", "text обовʼязковий");
    const owner = (await prisma.projectUser.findFirst({ where: { projectId, role: "owner" } })) || (await prisma.projectUser.findFirst({ where: { projectId } }));
    if (!owner) return fail("NO_OWNER", "У проєкту нема користувача, якому показати відповідь у чаті", 409);
    const base = process.env.NEXTAUTH_URL;
    const wh = process.env.WEBHOOK_SECRET;
    if (!base || !wh) return fail("MISCONFIGURED", "На сервері content2 не задано NEXTAUTH_URL або WEBHOOK_SECRET", 500);
    const sessionKey = `ads-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;

    // РЕКЛАМНЕ замовлення йде прямо у воронки реклами (ads-creative-image / -photo / -video), а не контент-менеджеру:
    // його диспетчер і генератор постів не знають мережі meta_ads і робили зі «креативів» звичайні пости Instagram
    // (текст = лише тема, картинка через fal recraft). Воронки реклами самі пишуть креатив за правилами adRules,
    // ставлять його в мережу meta_ads (формат ad_*, без черги публікації) і рендерять медіа. route="chat" примусово лишає старий шлях.
    const plan = b.route === "chat" ? null : planAdsOrder({ ...b, text, projectId }, new Date().toISOString().slice(0, 10));
    if (plan) {
      let fallbackNote = "";
      if (plan.needsPhotos) {
        // «з фото автора»: беремо реальні (не ШІ) фото з бібліотеки проєкту; нема жодного: падаємо на воронку з намальованою картинкою
        const media = await prisma.mediaItem.findMany({
          where: { projectId, aiGenerated: false, mimeType: { startsWith: "image/" }, folder: { in: ["source", "Threads Мацук", "photos", "Фото автора"] } },
          orderBy: { createdAt: "desc" }, take: 8, select: { filePath: true },
        });
        const urls = media.map((m) => abs(m.filePath)).filter(Boolean) as string[];
        if (urls.length) plan.params.photoUrls = urls;
        else { plan.funnel = "ads-creative-image"; delete plan.params.photoUrls; fallbackNote = " (у бібліотеці нема реальних фото автора, тому креативи будуть з намальованою картинкою)"; }
      }
      if (b.dryRun) return NextResponse.json({ ok: true, data: { dryRun: true, projectId, routedTo: plan.funnel, summary: plan.summary, params: { ...plan.params, note: String(plan.params.note || "").slice(0, 200) } } });
      const session = await prisma.chatSession.create({ data: { projectId, userId: owner.userId, sessionKey } });
      await prisma.chatMessage.create({ data: { sessionId: session.id, role: "user", content: text } });
      let accepted = true;
      try {
        const r = await fetch(`${FLOWS_BASE}/${plan.funnel}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan.params), signal: AbortSignal.timeout(10000) });
        accepted = r.ok;
      } catch (e: any) {
        accepted = e?.name === "TimeoutError" || e?.name === "AbortError"; // воронка працює асинхронно
      }
      const msg = accepted
        ? `Замовлення на рекламні креативи передано воронці «${plan.funnel}»: ${plan.summary}${fallbackNote}. Креативи зʼявляться в мережі «Реклама FB/IG» (формат ad_*, у чергу публікації не потрапляють); звіт прийде в Telegram.`
        : `Воронка «${plan.funnel}» не прийняла замовлення. Спробуйте ще раз.`;
      await prisma.chatMessage.create({ data: { sessionId: session.id, role: "assistant", content: msg } });
      if (!accepted) return fail("FLOWS_ERROR", `Воронка ${plan.funnel} не прийняла замовлення. Спробуйте ще раз.`, 502);
      return NextResponse.json({ ok: true, data: { sessionKey, projectId, routedTo: plan.funnel, summary: plan.summary } });
    }
    const payload = {
      message: text, sessionId: sessionKey, projectId,
      callbackUrl: `${base}/api/webhooks/chat-reply?token=${wh}&sessionKey=${sessionKey}&projectId=${projectId}`,
      importUrl: `${base}/api/posts/bulk-import?token=${wh}`,
      today: (() => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`; })(),
      todayISO: new Date().toISOString().slice(0, 10), history: [],
    };
    // Пробний режим: нічого не створює й не запускає, лише показує, що було б надіслано (без секретів).
    if (b.dryRun) return NextResponse.json({ ok: true, data: { dryRun: true, projectId, message: payload.message, owner: owner.userId } });
    const session = await prisma.chatSession.create({ data: { projectId, userId: owner.userId, sessionKey } });
    await prisma.chatMessage.create({ data: { sessionId: session.id, role: "user", content: text } });
    let accepted = true;
    try {
      const r = await fetch(FLOWS_CM, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
      accepted = r.ok;
    } catch (e: any) {
      // Таймаут не означає відмову: контент-менеджер може працювати довше, відповідь прийде в чат.
      accepted = e?.name === "TimeoutError" || e?.name === "AbortError";
    }
    if (!accepted) return fail("FLOWS_ERROR", "Контент-менеджер не прийняв запит. Спробуйте ще раз або напишіть у чат content2.", 502);
    return NextResponse.json({ ok: true, data: { sessionKey, projectId } });
  }

  if (action === "learning") {
    const title = clamp(b.title, 200); const content = clamp(b.content, 4000);
    if (!title || !content) return fail("VALIDATION_ERROR", "title і content обовʼязкові");
    const full = `Результат реклами: ${title}`;
    const existing = await prisma.knowledgeEntry.findFirst({ where: { projectId, title: { equals: full, mode: "insensitive" } } });
    if (existing) {
      const e = await prisma.knowledgeEntry.update({ where: { id: existing.id }, data: { content, isActive: true } });
      return NextResponse.json({ ok: true, data: { id: e.id, created: false } });
    }
    const e = await prisma.knowledgeEntry.create({ data: { projectId, category: "general", title: full, content, addedBy: "bot" } });
    return NextResponse.json({ ok: true, data: { id: e.id, created: true } });
  }

  return fail("VALIDATION_ERROR", "Невідома дія. Доступні: ping, personas, upsert_persona, creatives, order, learning");
}
