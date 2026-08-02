import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncStaticToVector } from "@/lib/vector-sync";

// Парсер онбординг-документів (ТЗ Agent A). Бере текст усіх завантажених доків
// (category=onboarding-doc), через flows/Gemini витягує структуровані Продукти/Персони/
// Кейси і зберігає (append+дедуп за назвою). Auth: x-webhook-secret.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FLOWS_RAG_URL = process.env.FLOWS_RAG_URL || "http://localhost:3000/api/rag/generate";
const FLOWS_RAG_SECRET = process.env.FLOWS_RAG_SECRET || "";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-webhook-secret") !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const projectId = body.projectId as string | undefined;
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const docs = await prisma.knowledgeEntry.findMany({
    where: { projectId, category: "onboarding-doc", isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!docs.length) return NextResponse.json({ ok: true, note: "немає документів", products: 0, personas: 0, cases: 0 });

  // Наявні продукти — щоб парсер прив'язував кожен кейс до потрібного продукту.
  const [existingProducts, existingPersonas] = await Promise.all([
    prisma.product.findMany({ where: { projectId }, select: { name: true } }),
    prisma.persona.findMany({ where: { projectId }, select: { name: true } }),
  ]);
  const productList = existingProducts.map((p) => p.name).join(", ") || "(ще немає)";
  const personaList = existingPersonas.map((p) => p.name).join(", ") || "(ще немає)";

  const combined = docs.map((d) => `# ${d.title}\n${d.content}`).join("\n\n---\n\n").slice(0, 40000);
  const prompt = `Ти — парсер онбордингу. З документів витягни СТРУКТУРОВАНІ дані компанії. Поверни РІВНО валідний JSON без тексту навколо:
{"products":[{"name":"","description":"","pains":"","transformation":"","benefits":"","price":"","audience":"","priority":1}],
"personas":[{"name":"","pains":"","goals":"","triggers":"","objections":"","language":"","tone":"","forbiddenWords":""}],
"cases":[{"title":"","product":"назва продукту, який демонструє кейс","niche":"","problem":"","solution":"","metrics":{"ключ":"значення"},"allowedClaims":""}]}
Витягни продукти, персони і кейси з документів.
ВАЖЛИВО (дедуп): наявні ПРОДУКТИ: ${productList}. Наявні ПЕРСОНИ: ${personaList}. Якщо продукт/персона з документа — це ТОЙ САМИЙ, що вже є (навіть якщо названо трохи інакше) — ВИКОРИСТАЙ ТОЧНО наявну назву, НЕ створюй варіант. Додавай у масив лише СПРАВДІ нові або уточнення наявних.
У КОЖНОГО кейса заповни "product" — назву продукту, який він демонструє (з наявних ${productList} або з масиву products). Чого немає — порожній масив. Не вигадуй фактів. Українською.

ДОКУМЕНТИ:
${combined}`;

  let text = "";
  try {
    const r = await fetch(FLOWS_RAG_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Rag-Secret": FLOWS_RAG_SECRET },
      body: JSON.stringify({ prompt, maxTokens: 8000 }),
    });
    const j = await r.json();
    text = j?.text || "";
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "LLM недоступний: " + String(e?.message || e) }, { status: 503 });
  }

  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  let data: any;
  try {
    data = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
  } catch {
    return NextResponse.json({ ok: false, error: "не вдалось розпарсити JSON від LLM", raw: text.slice(0, 300) }, { status: 500 });
  }

  const findByName = (m: any, f: string, v: string) => m.findFirst({ where: { projectId, [f]: { equals: v, mode: "insensitive" } } });
  const productMap = new Map<string, string>(); // name(lower) → productId
  let pc = 0, prc = 0, cc = 0;

  for (const p of (Array.isArray(data.products) ? data.products : [])) {
    if (!p?.name) continue;
    const ex = await findByName(prisma.product, "name", String(p.name));
    const f = { description: p.description || undefined, price: p.price || undefined, audience: p.audience || undefined, pains: p.pains || undefined, transformation: p.transformation || undefined, benefits: p.benefits || undefined, priority: Number.isFinite(Number(p.priority)) ? Number(p.priority) : undefined };
    const rec = ex ? await prisma.product.update({ where: { id: ex.id }, data: f }) : await prisma.product.create({ data: { projectId, name: String(p.name), ...f } });
    productMap.set(String(p.name).toLowerCase().trim(), rec.id);
    pc++;
  }
  // Домапимо всі наявні продукти (не лише щойно витягнуті) — для прив'язки кейсів
  for (const ep of await prisma.product.findMany({ where: { projectId }, select: { id: true, name: true } })) {
    productMap.set(ep.name.toLowerCase().trim(), ep.id);
  }
  for (const p of (Array.isArray(data.personas) ? data.personas : [])) {
    if (!p?.name) continue;
    const ex = await findByName(prisma.persona, "name", String(p.name));
    const f = { pains: p.pains || undefined, goals: p.goals || undefined, triggers: p.triggers || undefined, objections: p.objections || undefined, language: p.language || undefined, tone: p.tone || undefined, forbiddenWords: p.forbiddenWords || undefined };
    ex ? await prisma.persona.update({ where: { id: ex.id }, data: f }) : await prisma.persona.create({ data: { projectId, name: String(p.name), ...f } });
    prc++;
  }
  for (const c of (Array.isArray(data.cases) ? data.cases : [])) {
    if (!c?.title) continue;
    const productId = c.product ? productMap.get(String(c.product).toLowerCase().trim()) : undefined;
    const ex = await findByName(prisma.case, "title", String(c.title));
    const f = { niche: c.niche || undefined, problem: c.problem || undefined, solution: c.solution || undefined, metrics: (c.metrics && typeof c.metrics === "object") ? c.metrics : undefined, allowedClaims: c.allowedClaims || undefined, ...(productId ? { productId } : {}) };
    ex ? await prisma.case.update({ where: { id: ex.id }, data: f }) : await prisma.case.create({ data: { projectId, title: String(c.title), ...f } });
    cc++;
  }

  // Позначити оброблені документи, щоб парсер не перечитував їх наступного разу
  // (інакше кожен «далі» повторно плодить персони/продукти). Текст лишається у вектор Static.
  await prisma.knowledgeEntry.updateMany({
    where: { id: { in: docs.map((d) => d.id) } },
    data: { category: "onboarding-doc-done" },
  });

  syncStaticToVector(projectId).catch(() => {});
  return NextResponse.json({ ok: true, products: pc, personas: prc, cases: cc });
}
