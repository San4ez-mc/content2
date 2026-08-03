import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncStaticToVector } from "@/lib/vector-sync";
import { seedDefaultStructures } from "@/lib/seedStructures";

// Викликається онбординг-воронками flows (Агент A). Пише артефакт у content2.
// Ключові принципи: (1) таргетинг проєкту по projectId (не плодимо дублі);
// (2) ДОПИСУЄМО, не заміняємо — дедуп за назвою/заголовком.
// Auth: заголовок x-webhook-secret === WEBHOOK_SECRET.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { projectName, kind, data } = body as {
    projectId?: string; projectName?: string; kind?: string; data?: any;
  };
  const projectId = (body as any).projectId || req.nextUrl.searchParams.get("projectId") || undefined;
  if (!kind || !data) {
    return NextResponse.json({ error: "kind, data required" }, { status: 400 });
  }

  // Таргетинг проєкту: спершу явний projectId (не плодимо дублі), потім за назвою.
  let project = projectId ? await prisma.project.findUnique({ where: { id: projectId } }) : null;
  if (!project && projectName) project = await prisma.project.findFirst({ where: { name: projectName } });
  if (!project) {
    if (!projectName) return NextResponse.json({ error: "projectId or projectName required" }, { status: 400 });
    project = await prisma.project.create({ data: { name: projectName } });
    // Новий проєкт одразу отримує канонічні структури постів (щоб не було порожньо).
    await seedDefaultStructures(project.id).catch(() => {});
  }
  const pid = project.id;

  // Нормалізація назви для fuzzy-дедупу: нижній регістр, стиснуті пробіли,
  // прибрані хвостові дужки «(...)» — щоб «Розбір процесу» і «Розбір процесу (консультація)»
  // рахувались одним. Ловить варіанти назв, не лише точний збіг.
  // Коерсія текстових полів: LLM іноді шле масив/обʼєкт замість рядка (болі списком) —
  // Prisma чекає String і падає 500. Масив → «; »-рядок, обʼєкт → JSON, інше → String.
  const S = (v: any): string | undefined =>
    v == null ? undefined
    : Array.isArray(v) ? (v.filter((x) => x != null && x !== "").map(String).join("; ") || undefined)
    : typeof v === "object" ? JSON.stringify(v)
    : String(v);
  const normName = (s: any) => String(s || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/\s*\([^)]*\)\s*$/, "").trim();
  const findByName = async (model: any, field: string, value: string) => {
    const target = normName(value);
    if (!target) return null;
    const rows = await model.findMany({ where: { projectId: pid }, select: { id: true, [field]: true } });
    const hit = rows.find((r: any) => normName(r[field]) === target);
    return hit ? { id: hit.id } : null;
  };

  let saved: any = null;
  try {
    if (kind === "product") {
      const fields = {
        description: S(data.description), price: S(data.price), audience: S(data.audience),
        pains: S(data.pains), transformation: S(data.transformation),
        benefits: S(data.benefits), priority: Number.isFinite(Number(data.priority)) ? Number(data.priority) : undefined,
      };
      const existing = await findByName(prisma.product, "name", String(data.name || "Продукт"));
      saved = existing
        ? await prisma.product.update({ where: { id: existing.id }, data: fields })
        : await prisma.product.create({ data: { projectId: pid, name: String(data.name || "Продукт"), ...fields } });
    } else if (kind === "persona") {
      const fields = {
        age: Number.isFinite(Number(data.age)) ? Number(data.age) : undefined,
        gender: S(data.gender), type: S(data.type),
        pains: S(data.pains), goals: S(data.goals), tone: S(data.tone),
        forbiddenWords: S(data.forbiddenWords), triggers: S(data.triggers),
        objections: S(data.objections), language: S(data.language),
      };
      const existing = await findByName(prisma.persona, "name", String(data.name || "Персона"));
      saved = existing
        ? await prisma.persona.update({ where: { id: existing.id }, data: fields })
        : await prisma.persona.create({ data: { projectId: pid, name: String(data.name || "Персона"), ...fields } });
    } else if (kind === "case") {
      // Прив'язка кейса до продукту за назвою (data.product | productName)
      const prodName = data.product || data.productName;
      const prod = prodName ? await findByName(prisma.product, "name", String(prodName)) : null;
      const fields = {
        niche: S(data.niche), problem: S(data.problem), solution: S(data.solution),
        metrics: data.metrics && typeof data.metrics === "object" ? data.metrics : undefined,
        allowedClaims: S(data.allowedClaims),
        ...(prod ? { productId: prod.id } : {}),
      };
      const existing = await findByName(prisma.case, "title", String(data.title || "Кейс"));
      saved = existing
        ? await prisma.case.update({ where: { id: existing.id }, data: fields })
        : await prisma.case.create({ data: { projectId: pid, title: String(data.title || "Кейс"), ...fields } });
    } else if (kind === "products") {
      // Масив продуктів (етап «продукти на початку»). Append+дедуп за назвою.
      const items: any[] = Array.isArray(data.products) ? data.products : Array.isArray(data) ? data : [];
      let n = 0;
      for (const p of items) {
        if (!p?.name) continue;
        const fields = {
          description: S(p.description), price: S(p.price), audience: S(p.audience),
          pains: S(p.pains), transformation: S(p.transformation), benefits: S(p.benefits),
          priority: Number.isFinite(Number(p.priority)) ? Number(p.priority) : undefined,
        };
        const ex = await findByName(prisma.product, "name", String(p.name));
        if (ex) await prisma.product.update({ where: { id: ex.id }, data: fields });
        else await prisma.product.create({ data: { projectId: pid, name: String(p.name), ...fields } });
        n++;
      }
      saved = { created: n };
    } else if (kind === "leadmagnet") {
      // Лід-магніт прив'язується до продукту (за назвою або до першого).
      let productRec = data.productName ? await findByName(prisma.product, "name", String(data.productName)) : null;
      if (!productRec) productRec = await prisma.product.findFirst({ where: { projectId: pid }, orderBy: { sortOrder: "asc" } });
      if (!productRec) return NextResponse.json({ error: "leadmagnet: немає продукту для прив'язки" }, { status: 400 });
      const existing = await prisma.leadMagnet.findFirst({ where: { projectId: pid, productId: productRec.id, name: { equals: String(data.name || "Лід-магніт"), mode: "insensitive" } } });
      const fields = { description: S(data.description), funnelSlug: S(data.funnelSlug) };
      saved = existing
        ? await prisma.leadMagnet.update({ where: { id: existing.id }, data: fields })
        : await prisma.leadMagnet.create({ data: { projectId: pid, productId: productRec.id, name: String(data.name || "Лід-магніт"), ...fields } });
    } else if (kind === "topics") {
      // ~50 тем від ШІ → банк тем (status=idea). Дедуп за title. data.topics: [{rubric,title,notes?}]
      const items: any[] = Array.isArray(data.topics) ? data.topics : Array.isArray(data) ? data : [];
      const existing = new Set((await prisma.contentTopic.findMany({ where: { projectId: pid }, select: { title: true } })).map((t) => t.title.toLowerCase().trim()));
      const toCreate = items
        .filter((t) => t?.title && !existing.has(String(t.title).toLowerCase().trim()))
        .map((t) => ({ projectId: pid, rubric: String(t.rubric || "galuzi"), title: String(t.title), notes: t.notes ? String(t.notes) : null, status: "idea" }));
      const res = toCreate.length ? await prisma.contentTopic.createMany({ data: toCreate, skipDuplicates: true }) : { count: 0 };
      saved = { created: res.count, received: items.length };
    } else if (kind === "strategy") {
      const fields = {
        contentPillars: Array.isArray(data.contentPillars) ? data.contentPillars : [],
        intentDistribution: data.intentDistribution && typeof data.intentDistribution === "object" ? data.intentDistribution : {},
      };
      const latest = await prisma.smmStrategy.findFirst({ where: { projectId: pid }, orderBy: { version: "desc" } });
      saved = latest
        ? await prisma.smmStrategy.update({ where: { id: latest.id }, data: fields })
        : await prisma.smmStrategy.create({ data: { projectId: pid, ...fields } });
    } else if (kind === "doc") {
      // Витягнутий текст завантаженого документа → KnowledgeEntry (піде у вектор Static).
      const title = String(data.fileName || data.title || "Документ").slice(0, 200);
      const content = String(data.text || data.content || "").trim();
      if (!content) return NextResponse.json({ error: "doc: порожній текст" }, { status: 400 });
      const existing = await prisma.knowledgeEntry.findFirst({ where: { projectId: pid, category: "onboarding-doc", title: { equals: title, mode: "insensitive" } } });
      saved = existing
        ? await prisma.knowledgeEntry.update({ where: { id: existing.id }, data: { content, isActive: true } })
        : await prisma.knowledgeEntry.create({ data: { projectId: pid, category: "onboarding-doc", title, content, addedBy: "bot" } });
    } else if (kind === "brand") {
      const title = String(data.title || "Бренд і Tone of Voice");
      const content = String(data.content || "");
      const existing = await prisma.knowledgeEntry.findFirst({ where: { projectId: pid, title: { equals: title, mode: "insensitive" } } });
      saved = existing
        ? await prisma.knowledgeEntry.update({ where: { id: existing.id }, data: { content, category: "brand", isActive: true } })
        : await prisma.knowledgeEntry.create({ data: { projectId: pid, category: "brand", title, content, addedBy: "bot" } });
    } else {
      return NextResponse.json({ error: `unknown kind: ${kind}` }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }

  // Ре-синк Client Static у вектор (fire-and-forget — не блокуємо воронку).
  syncStaticToVector(pid).catch(() => {});

  // Публічне посилання на сторінку, де видно збережений артефакт (агент дає клієнту).
  const BASE = process.env.NEXTAUTH_URL || "https://content2.fineko.space";
  const viewUrlByKind: Record<string, string> = {
    product: `${BASE}/products`, products: `${BASE}/products`, leadmagnet: `${BASE}/lead-magnets`,
    topics: `${BASE}/topics`, persona: `${BASE}/user-data`, case: `${BASE}/user-data`,
    strategy: `${BASE}/user-data`, brand: `${BASE}/user-data`, doc: `${BASE}/storage`,
  };
  const viewUrl = viewUrlByKind[kind] || `${BASE}/user-data`;

  return NextResponse.json({ ok: true, projectId: pid, kind, id: saved?.id ?? null, result: saved, viewUrl });
}
