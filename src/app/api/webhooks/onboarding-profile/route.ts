import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Спільна пам'ять онбордингу: повертає, що вже відомо про компанію, + перелік дірок.
// Воронки викликають ПЕРЕД питаннями, щоб не перепитувати і закривати лише прогалини
// (Confidence Check). Auth: x-webhook-secret === WEBHOOK_SECRET.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { projectName } = body as { projectName?: string };
  const projectId = (body as any).projectId || req.nextUrl.searchParams.get("projectId") || undefined;

  let project = projectId ? await prisma.project.findUnique({ where: { id: projectId } }) : null;
  if (!project && projectName) project = await prisma.project.findFirst({ where: { name: projectName } });
  if (!project) {
    return NextResponse.json({ ok: true, exists: false, gaps: ["product", "persona", "case", "strategy", "topics", "leadmagnet", "brand"], summary: "Нова компанія — нічого ще не відомо." });
  }
  const pid = project.id;

  const [products, personas, cases, leadMagnets, strategy, topicsCount, brand] = await Promise.all([
    prisma.product.findMany({ where: { projectId: pid }, select: { name: true, pains: true, price: true } }),
    prisma.persona.findMany({ where: { projectId: pid }, select: { name: true, pains: true, triggers: true, objections: true } }),
    prisma.case.count({ where: { projectId: pid } }),
    prisma.leadMagnet.count({ where: { projectId: pid } }),
    prisma.smmStrategy.findFirst({ where: { projectId: pid }, orderBy: { version: "desc" }, select: { contentPillars: true } }),
    prisma.contentTopic.count({ where: { projectId: pid } }),
    prisma.knowledgeEntry.findFirst({ where: { projectId: pid, category: "brand", isActive: true }, select: { id: true } }),
  ]);

  const known = {
    products: products.map((p) => ({ name: p.name, hasPains: !!p.pains })),
    personas: personas.map((p) => ({ name: p.name, hasTriggers: !!p.triggers, hasObjections: !!p.objections })),
    cases: cases,
    leadMagnets,
    strategy: !!strategy,
    topics: topicsCount,
    brandToV: !!brand,
  };

  const gaps: string[] = [];
  if (!products.length) gaps.push("product");
  else if (products.some((p) => !p.pains)) gaps.push("product-pains");
  if (!personas.length) gaps.push("persona");
  else if (personas.some((p) => !p.triggers || !p.objections)) gaps.push("persona-depth");
  if (!cases) gaps.push("case");
  if (!strategy) gaps.push("strategy");
  if (topicsCount < 20) gaps.push("topics");
  if (!leadMagnets) gaps.push("leadmagnet");
  if (!brand) gaps.push("brand");

  // Прогрес заповнення профілю (%) — зважений по секціях
  let progress = 0;
  if (products.length) progress += 20;
  if (personas.length) progress += 20;
  if (brand) progress += 15;
  if (strategy) progress += 20;
  if (cases) progress += 15;
  if (topicsCount >= 20) progress += 10;

  // Компактний текст для інжекту в промпт бота
  const summary = [
    `Профіль заповнено на ${progress}%.`,
    `Компанія: ${project.name}.`,
    products.length ? `Продукти: ${products.map((p) => p.name).join(", ")}.` : "Продуктів ще нема.",
    personas.length ? `Персони: ${personas.map((p) => p.name).join(", ")}.` : "Персон ще нема.",
    `Кейсів: ${cases}. Лід-магнітів: ${leadMagnets}. Тем: ${topicsCount}.`,
    `Стратегія: ${strategy ? "є" : "нема"}. Бренд/ToV: ${brand ? "є" : "нема"}.`,
  ].join(" ");

  return NextResponse.json({ ok: true, exists: true, projectId: pid, projectName: project.name, progress, known, gaps, summary });
}
