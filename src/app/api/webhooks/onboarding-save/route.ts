import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncStaticToVector } from "@/lib/vector-sync";

// Викликається онбординг-воронками flows (Агент A). Find-or-create проект за назвою
// компанії + збереження артефакту (продукт / персона / стратегія / бренд-ToV).
// Auth: заголовок x-webhook-secret === WEBHOOK_SECRET.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { projectName, kind, data } = body as { projectName?: string; kind?: string; data?: any };
  if (!projectName || !kind || !data) {
    return NextResponse.json({ error: "projectName, kind, data required" }, { status: 400 });
  }

  // find-or-create проект (= компанія в контент-платформі)
  let project = await prisma.project.findFirst({ where: { name: projectName } });
  if (!project) project = await prisma.project.create({ data: { name: projectName } });
  const projectId = project.id;

  let saved: any = null;
  try {
    if (kind === "product") {
      saved = await prisma.product.create({
        data: {
          projectId, name: String(data.name || "Продукт"),
          description: data.description || null, price: data.price || null, audience: data.audience || null,
        },
      });
    } else if (kind === "persona") {
      saved = await prisma.persona.create({
        data: {
          projectId, name: String(data.name || "Персона"),
          age: Number.isFinite(Number(data.age)) ? Number(data.age) : null,
          gender: data.gender || null, type: data.type || null,
          pains: data.pains || null, goals: data.goals || null,
          tone: data.tone || null, forbiddenWords: data.forbiddenWords || null,
        },
      });
    } else if (kind === "strategy") {
      saved = await prisma.smmStrategy.create({
        data: {
          projectId,
          contentPillars: Array.isArray(data.contentPillars) ? data.contentPillars : [],
          intentDistribution: data.intentDistribution && typeof data.intentDistribution === "object" ? data.intentDistribution : {},
        },
      });
    } else if (kind === "brand") {
      // ToV / бренд-правила → KnowledgeEntry (як save-knowledge)
      const title = String(data.title || "Бренд і Tone of Voice");
      const content = String(data.content || "");
      const existing = await prisma.knowledgeEntry.findFirst({ where: { projectId, title: { equals: title, mode: "insensitive" } } });
      saved = existing
        ? await prisma.knowledgeEntry.update({ where: { id: existing.id }, data: { content, category: "brand", isActive: true } })
        : await prisma.knowledgeEntry.create({ data: { projectId, category: "brand", title, content, addedBy: "bot" } });
    } else {
      return NextResponse.json({ error: `unknown kind: ${kind}` }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }

  // Ре-синк Client Static у вектор (fire-and-forget — не блокуємо воронку).
  syncStaticToVector(projectId).catch(() => {});

  return NextResponse.json({ ok: true, projectId, kind, id: saved?.id });
}
