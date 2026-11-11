import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Службовий інструмент порядку в проєктах (компаніях) для Flows/адміністратора: переглянути обсяг даних у кожному
// й архівувати (isActive=false: проєкт зникає з перемикача, дані лишаються, `unarchive` повертає).
// НІЧОГО не видаляє. Злиття/видалення — окремими, свідомими кроками.
// Auth: x-webhook-secret === WEBHOOK_SECRET.
// Body: { action: "list" } | { action: "export" | "archive" | "unarchive", ids: string[] } | schedule/network/retime (див. нижче)
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-webhook-secret") !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { action?: string; ids?: unknown };
  const action = String(body.action || "list");

  if (action === "archive" || action === "unarchive") {
    const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
    if (!ids.length) return NextResponse.json({ ok: false, error: "ids обовʼязкові (явний список)" }, { status: 400 });
    const rows = await prisma.project.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    await prisma.project.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { isActive: action === "unarchive" } });
    return NextResponse.json({ ok: true, action, changed: rows });
  }

  // Налаштування доставки контенту (за запитом власника): розклад проєкту, прапорці мереж, час постів.
  //  { action: "schedule", projectId, days?: {monday:[..],…}, sendToTelegram?, telegramChatId?, digestTime?, digestChatId? }
  //  { action: "network", projectId, set: [{ platformKey, sendToTelegram?, postDirectly? }] }
  //  { action: "retime", projectId, platformKey, from: "YYYY-MM-DD", to: "YYYY-MM-DD", times: ["09:00","12:00",…] } — розкидає пости кожного дня по часах
  if (action === "schedule" || action === "network" || action === "retime") {
    const b = body as any;
    const projectId = String(b.projectId || "");
    if (!projectId) return NextResponse.json({ ok: false, error: "projectId обовʼязковий" }, { status: 400 });
    if (action === "schedule") {
      const data: any = {};
      for (const d of ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]) {
        if (b.days && Array.isArray(b.days[d])) data[d] = b.days[d].map(String);
      }
      if (typeof b.sendToTelegram === "boolean") data.sendToTelegram = b.sendToTelegram;
      for (const k of ["telegramChatId", "digestTime", "digestChatId"]) if (k in b) data[k] = b[k] === null || b[k] === "" ? null : String(b[k]);
      const before = await prisma.scheduleSettings.findUnique({ where: { projectId } });
      const after = await prisma.scheduleSettings.upsert({ where: { projectId }, update: data, create: { projectId, ...data } });
      return NextResponse.json({ ok: true, before, after });
    }
    if (action === "network") {
      const set = Array.isArray(b.set) ? b.set : [];
      const changed: any[] = [];
      for (const x of set) {
        const data: any = {};
        if (typeof x.sendToTelegram === "boolean") data.sendToTelegram = x.sendToTelegram;
        if (typeof x.postDirectly === "boolean") data.postDirectly = x.postDirectly;
        if (!Object.keys(data).length) continue;
        const r = await prisma.socialNetwork.updateMany({ where: { projectId, platformKey: String(x.platformKey) }, data });
        changed.push({ platformKey: x.platformKey, ...data, rows: r.count });
      }
      return NextResponse.json({ ok: true, changed });
    }
    // retime
    const times: string[] = Array.isArray(b.times) ? b.times.map(String).filter((t: string) => /^\d{1,2}:\d{2}$/.test(t)) : [];
    if (!times.length || !b.from || !b.to || !b.platformKey) return NextResponse.json({ ok: false, error: "platformKey, from, to, times обовʼязкові" }, { status: 400 });
    const groups = await prisma.postGroup.findMany({
      where: { projectId, socialNetwork: { platformKey: String(b.platformKey) }, postDate: { gte: new Date(String(b.from)), lte: new Date(String(b.to)) } },
      orderBy: [{ postDate: "asc" }, { number: "asc" }],
      select: { id: true, postDate: true },
    });
    const perDay = new Map<string, number>();
    let n = 0;
    for (const g of groups) {
      const day = g.postDate.toISOString().slice(0, 10);
      const idx = perDay.get(day) || 0;
      perDay.set(day, idx + 1);
      await prisma.postGroup.update({ where: { id: g.id }, data: { scheduleTime: times[idx % times.length] } });
      n++;
    }
    const counts = Array.from(perDay.values());
    return NextResponse.json({ ok: true, updated: n, days: perDay.size, minPerDay: counts.length ? Math.min(...counts) : 0, maxPerDay: counts.length ? Math.max(...counts) : 0 });
  }

  // Резервна копія даних проєктів перед злиттям/видаленням: усе, крім постів і медіафайлів (лише читання).
  if (action === "export") {
    const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
    if (!ids.length) return NextResponse.json({ ok: false, error: "ids обовʼязкові" }, { status: 400 });
    const data = [] as any[];
    for (const id of ids) {
      const where = { projectId: id };
      data.push({
        project: await prisma.project.findUnique({ where: { id } }),
        products: await prisma.product.findMany({ where }),
        leadMagnets: await prisma.leadMagnet.findMany({ where }),
        personas: await prisma.persona.findMany({ where }),
        cases: await prisma.case.findMany({ where }),
        knowledgeEntries: await prisma.knowledgeEntry.findMany({ where }),
        contentTopics: await prisma.contentTopic.findMany({ where }),
        founderProfile: await prisma.founderProfile.findUnique({ where }),
        sellerConfig: await prisma.sellerConfig.findUnique({ where }),
        sellerDossier: await prisma.sellerDossier.findUnique({ where }),
        socialNetworks: await prisma.socialNetwork.findMany({ where }),
        scheduleSettings: await prisma.scheduleSettings.findUnique({ where }),
      });
    }
    return NextResponse.json({ ok: true, exportedAt: new Date().toISOString(), data });
  }

  const projects = await prisma.project.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, isActive: true, createdAt: true } });
  const out = [] as any[];
  for (const p of projects) {
    const where = { projectId: p.id };
    const [posts, lastPost, products, personas, cases, topics, knowledge, networks, users, media, hasSeller, hasFounder, leadMagnets, prodNames] = await Promise.all([
      prisma.postGroup.count({ where }),
      prisma.postGroup.findFirst({ where, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.product.count({ where }),
      prisma.persona.count({ where }),
      prisma.case.count({ where }),
      prisma.contentTopic.count({ where }),
      prisma.knowledgeEntry.count({ where }),
      prisma.socialNetwork.count({ where }),
      prisma.projectUser.count({ where }),
      prisma.mediaItem.count({ where }),
      prisma.sellerConfig.count({ where }),
      prisma.founderProfile.count({ where }),
      prisma.leadMagnet.count({ where }),
      prisma.product.findMany({ where, select: { name: true }, take: 6 }),
    ]);
    out.push({
      id: p.id, name: p.name, isActive: p.isActive, created: p.createdAt.toISOString().slice(0, 10),
      lastPost: lastPost ? lastPost.createdAt.toISOString().slice(0, 10) : null,
      counts: { posts, products, personas, cases, topics, knowledge, networks, users, media, leadMagnets },
      sellerConfig: hasSeller > 0, founder: hasFounder > 0, products: prodNames.map((x) => x.name),
    });
  }
  return NextResponse.json({ ok: true, projects: out });
}
