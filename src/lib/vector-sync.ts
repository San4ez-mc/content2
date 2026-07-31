// Забезпечення вектор-проєкту компанії + синхронізація Client Static з БД.
// Static = стабільні знання: бренд/ToV, персони, продукти, лід-магніти, кейси,
// SMM-стратегія, short profile. Ре-синк ідемпотентний: чистимо static → re-ingest.
import { prisma } from "@/lib/prisma";
import { createVectorProject, vectorIngest, vectorDelete, type VectorChunk } from "@/lib/vector";

/** Повертає токен вектор-проєкту компанії, створюючи проєкт за потреби. null — сервіс недоступний. */
export async function ensureProjectVector(projectId: string): Promise<string | null> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return null;
  if (project.vectorToken) return project.vectorToken;

  const created = await createVectorProject(project.name || `project-${projectId}`);
  if (!created) return null;
  await prisma.project.update({
    where: { id: projectId },
    data: { vectorProjectId: created.projectId, vectorToken: created.rootToken },
  });
  return created.rootToken;
}

function clip(s: string | null | undefined, n = 600): string {
  const t = String(s || "").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

/** Стислий бренд-профіль (~короткий контекст для RAG-бюджету). */
function buildShortProfile(parts: { name: string; brand: any[]; personas: any[]; products: any[] }): string {
  const lines: string[] = [`Компанія: ${parts.name}`];
  const tov = parts.brand.find((b) => b.category === "brand");
  if (tov) lines.push(`Тон голосу: ${clip(tov.content, 300)}`);
  if (parts.personas.length) lines.push(`ЦА: ${parts.personas.map((p) => p.name).join(", ")}`);
  if (parts.products.length) lines.push(`Продукти: ${parts.products.map((p) => p.name).join(", ")}`);
  return lines.join("\n");
}

/** Повний ре-синк Client Static для проєкту. Ідемпотентний. */
export async function syncStaticToVector(
  projectId: string,
): Promise<{ ok: true; ingested: number } | { ok: false; reason: string }> {
  const token = await ensureProjectVector(projectId);
  if (!token) return { ok: false, reason: "Вектор-сервіс недоступний або проєкт не створено." };

  const [project, brand, personas, products, cases, strategy] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.knowledgeEntry.findMany({ where: { projectId, isActive: true } }),
    prisma.persona.findMany({ where: { projectId } }),
    prisma.product.findMany({ where: { projectId }, include: { leadMagnets: true } }),
    prisma.case.findMany({ where: { projectId } }),
    prisma.smmStrategy.findFirst({ where: { projectId }, orderBy: { version: "desc" } }),
  ]);

  const chunks: VectorChunk[] = [];

  for (const b of brand) {
    chunks.push({ source: `brand:${b.id}`, content: `${b.title}\n${b.content}`, metadata: { kind: "brand", id: b.id, category: b.category } });
  }
  for (const p of personas) {
    const content = [`Персона: ${p.name}`, p.pains && `Болі: ${p.pains}`, p.goals && `Цілі: ${p.goals}`, p.tone && `Тон: ${p.tone}`, p.forbiddenWords && `Уникати: ${p.forbiddenWords}`].filter(Boolean).join("\n");
    chunks.push({ source: `persona:${p.id}`, content, metadata: { kind: "persona", id: p.id } });
  }
  for (const p of products) {
    const lm = (p as any).leadMagnets?.map((m: any) => m.name).join(", ");
    const content = [`Продукт: ${p.name}`, p.price && `Ціна: ${p.price}`, p.description && `Опис: ${p.description}`, p.audience && `ЦА: ${p.audience}`, lm && `Лід-магніти: ${lm}`].filter(Boolean).join("\n");
    chunks.push({ source: `product:${p.id}`, content, metadata: { kind: "product", id: p.id } });
  }
  for (const c of cases) {
    const m = c.metrics && typeof c.metrics === "object" ? Object.entries(c.metrics as any).map(([k, v]) => `${k}: ${v}`).join(", ") : "";
    const content = [`Кейс: ${c.title}`, c.niche && `Ніша: ${c.niche}`, c.problem && `Проблема: ${c.problem}`, c.solution && `Рішення: ${c.solution}`, m && `Результати: ${m}`, c.allowedClaims && `Дозволені формулювання: ${c.allowedClaims}`].filter(Boolean).join("\n");
    // case_id у metadata — критично для case-integrity/anti-repeat
    chunks.push({ source: `case:${c.id}`, content, metadata: { kind: "case", id: c.id, caseId: c.id } });
  }
  if (strategy) {
    const pillars = Array.isArray(strategy.contentPillars) ? (strategy.contentPillars as any[]).join(", ") : "";
    const intent = strategy.intentDistribution && typeof strategy.intentDistribution === "object" ? Object.entries(strategy.intentDistribution as any).map(([k, v]) => `${k} ${v}`).join(", ") : "";
    chunks.push({ source: `strategy`, content: `SMM-стратегія\nКонтент-стовпи: ${pillars}\nБаланс цілей: ${intent}`, metadata: { kind: "strategy" } });
  }
  chunks.push({
    source: "short-profile",
    content: buildShortProfile({ name: project?.name || "", brand, personas, products }),
    metadata: { kind: "short-profile" },
  });

  // Ідемпотентність: чистимо static, потім re-ingest
  await vectorDelete(token, "static");
  const r = await vectorIngest(token, "static", chunks);
  if (!r) return { ok: false, reason: "Не вдалось проіндексувати (ingest повернув помилку)." };

  await prisma.project.update({ where: { id: projectId }, data: { vectorSyncedAt: new Date() } });
  return { ok: true, ingested: r.ingested };
}
