import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Context Loader (Ф1) — збирає бренд-контекст компанії з content2 для контент-менеджера
// (замість читання зі старої content.fineko.space + захардкодженого CONTENT_CORE_RULES).
// Повертає структуровані дані + компактний текстовий блок для інжекту в промпт генерації.
// Auth: x-webhook-secret (викликає воронка flows).
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-webhook-secret") !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const projectId = body.projectId as string | undefined;
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const cooldown = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // теми, не вживані 14 дн

  const [project, products, personas, brand, strategy, cases, topics] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.product.findMany({ where: { projectId, isActive: true }, orderBy: { priority: "asc" }, include: { leadMagnets: { select: { name: true } } } }),
    prisma.persona.findMany({ where: { projectId } }),
    prisma.knowledgeEntry.findMany({ where: { projectId, category: "brand", isActive: true } }),
    prisma.smmStrategy.findFirst({ where: { projectId }, orderBy: { version: "desc" } }),
    prisma.case.findMany({ where: { projectId }, include: { product: { select: { name: true } } } }),
    prisma.contentTopic.findMany({
      where: { projectId, isActive: true, status: { in: ["idea", "planned"] }, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: cooldown } }] },
      orderBy: [{ timesUsed: "asc" }, { sortOrder: "asc" }], take: 60,
    }),
  ]);

  const structured = {
    company: project?.name || "",
    products: products.map((p) => ({ name: p.name, description: p.description, pains: p.pains, transformation: p.transformation, benefits: p.benefits, price: p.price, audience: p.audience, leadMagnets: p.leadMagnets.map((m) => m.name) })),
    personas: personas.map((p) => ({ name: p.name, pains: p.pains, goals: p.goals, triggers: p.triggers, objections: p.objections, tone: p.tone })),
    tone: brand.map((b) => ({ title: b.title, content: b.content })),
    strategy: strategy ? { contentPillars: strategy.contentPillars, intentDistribution: strategy.intentDistribution } : null,
    // Кейси — тільки як записи з id (case-integrity): назва + дозволені формулювання
    cases: cases.map((c) => ({ id: c.id, title: c.title, product: c.product?.name || null, niche: c.niche, metrics: c.metrics, allowedClaims: c.allowedClaims })),
    topics: topics.map((t) => ({ id: t.id, rubric: t.rubric, title: t.title })),
  };

  // Компактний текстовий блок для промпту (обрізаний під бюджет)
  const clip = (s: any, n = 200) => String(s || "").trim().slice(0, n);
  const pillars = strategy && Array.isArray(strategy.contentPillars) ? (strategy.contentPillars as any[]).join(", ") : "—";
  const intent = strategy && strategy.intentDistribution && typeof strategy.intentDistribution === "object"
    ? Object.entries(strategy.intentDistribution as any).map(([k, v]) => `${k} ${v}`).join(", ") : "—";
  const text = [
    `КОМПАНІЯ: ${structured.company}`,
    `ПРОДУКТИ:\n${products.map((p) => `• ${p.name}${p.price ? ` (${p.price})` : ""} — ${clip(p.description, 120)}${p.pains ? ` | болі: ${clip(p.pains, 120)}` : ""}`).join("\n") || "—"}`,
    `ПЕРСОНИ (ЦА):\n${personas.map((p) => `• ${p.name}: болі ${clip(p.pains, 100)}; тригери ${clip(p.triggers, 80)}`).join("\n") || "—"}`,
    `ТОН ГОЛОСУ:\n${brand.map((b) => clip(b.content, 400)).join("\n") || "—"}`,
    `СТРАТЕГІЯ: стовпи — ${pillars}; баланс цілей — ${intent}`,
    `КЕЙСИ (ТІЛЬКИ реальні, з id — не вигадувати; ${cases.length} шт.):\n${cases.slice(0, 25).map((c) => `• [${c.id}] ${c.title}${c.product?.name ? ` (${c.product.name})` : ""}${c.allowedClaims ? ` — можна: ${clip(c.allowedClaims, 100)}` : ""}`).join("\n") || "—"}`,
    `БАНК ТЕМ (доступні, cooldown 14дн; обери звідси):\n${topics.slice(0, 40).map((t) => `• [${t.id}] (${t.rubric}) ${t.title}`).join("\n") || "—"}`,
  ].join("\n\n");

  return NextResponse.json({ ok: true, structured, text, counts: { products: products.length, personas: personas.length, cases: cases.length, topics: topics.length, strategy: !!strategy } });
}
