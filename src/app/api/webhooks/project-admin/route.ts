import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Службовий інструмент порядку в проєктах (компаніях) для Flows/адміністратора: переглянути обсяг даних у кожному
// й архівувати (isActive=false: проєкт зникає з перемикача, дані лишаються, `unarchive` повертає).
// НІЧОГО не видаляє. Злиття/видалення — окремими, свідомими кроками.
// Auth: x-webhook-secret === WEBHOOK_SECRET.
// Body: { action: "list" } | { action: "export" | "archive" | "unarchive", ids: string[] }
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
