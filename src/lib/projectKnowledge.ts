// «База знань проєкту» для Flows (27.10, запит власника: усе про експерта в одному місці + швидкі переходи в content2).
// Віддає зведення того, що content2 знає про проєкт: експерт, послуги, кейси, персони, правила/факти, налаштування продавця.
// Кожна секція має `path` — сторінка content2, де це редагується (Flows додає домен і ?projectId=). Читання, без правок.
import { prisma } from "./prisma";
import { DOC_PREFIX } from "./sellerBrief";
import { sellerAdminView } from "./sellerAdmin";
import { getDossier, dossierSummary } from "./sellerDossierStore";

const cut = (s: unknown, n = 160) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : (x as { text?: string })?.text ? String((x as { text?: string }).text) : "")).filter(Boolean) : [];

export type KnowledgeSection = {
  id: string;
  title: string;
  icon: string;
  path: string; // сторінка content2 для редагування
  count: number;
  empty: boolean; // нічого не заповнено
  items: { title: string; text?: string; tag?: string }[];
};

const CATEGORY_LABEL: Record<string, string> = { style: "Стиль", rule: "Правила", forbidden: "Заборонене", tone: "Тон", audience: "Аудиторія", general: "Загальне", fact: "Факти" };

export async function projectKnowledgeView(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } });
  if (!project) return null;
  const [founder, products, cases, personas, entries] = await Promise.all([
    prisma.founderProfile.findUnique({ where: { projectId } }),
    prisma.product.findMany({ where: { projectId, isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.case.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.persona.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.knowledgeEntry.findMany({ where: { projectId, isActive: true, supersededAt: null, NOT: { title: { startsWith: DOC_PREFIX } } }, orderBy: { updatedAt: "desc" } }),
  ]);

  const expertItems: KnowledgeSection["items"] = [];
  if (founder?.core) expertItems.push({ title: "Хто це", text: cut(founder.core, 260) });
  const strengths = strList(founder?.strengths);
  if (strengths.length) expertItems.push({ title: "Сильні сторони", text: cut(strengths.slice(0, 5).join(" · "), 260) });
  const diffs = strList(founder?.differentiators);
  if (diffs.length) expertItems.push({ title: "Чим відрізняється", text: cut(diffs.slice(0, 4).join(" · "), 260) });
  if (founder?.interactionStyle) expertItems.push({ title: "Як працює з клієнтом", text: cut(founder.interactionStyle, 200) });
  if (founder?.archetypePrimary) expertItems.push({ title: "Архетип", text: founder.archetypePrimary + (founder.archetypeSecondary ? " + " + founder.archetypeSecondary : "") });

  const byCat = new Map<string, typeof entries>();
  for (const e of entries) { const k = e.category || "general"; if (!byCat.has(k)) byCat.set(k, []); byCat.get(k)!.push(e); }
  const ruleItems: KnowledgeSection["items"] = [];
  for (const [cat, list] of Array.from(byCat.entries())) {
    for (const e of list.slice(0, 4)) ruleItems.push({ title: e.title, text: cut(e.content, 140), tag: CATEGORY_LABEL[cat] || cat });
  }

  const sections: KnowledgeSection[] = [
    { id: "expert", title: "Експерт", icon: "👤", path: "/user-data", count: expertItems.length, empty: expertItems.length === 0, items: expertItems },
    { id: "products", title: "Послуги й продукти", icon: "💼", path: "/products", count: products.length, empty: products.length === 0,
      items: products.slice(0, 6).map((p) => ({ title: p.name, text: cut(p.description, 160), tag: p.price || undefined })) },
    { id: "cases", title: "Кейси", icon: "🧩", path: "/user-data", count: cases.length, empty: cases.length === 0,
      items: cases.slice(0, 6).map((c) => ({ title: c.title, text: cut(c.problem || c.solution, 140), tag: c.niche || undefined })) },
    { id: "personas", title: "Кому підходить (персони)", icon: "👥", path: "/personas", count: personas.length, empty: personas.length === 0,
      items: personas.slice(0, 6).map((p) => ({ title: p.name, text: cut(p.pains, 140) })) },
    { id: "rules", title: "Правила, факти, заперечення", icon: "📌", path: "/facts", count: entries.length, empty: entries.length === 0, items: ruleItems },
  ];

  const seller = await sellerAdminView(projectId);
  const dossier = await getDossier(projectId);
  return {
    projectId: project.id,
    projectName: project.name,
    sections,
    dossier: dossierSummary(dossier ? dossier.state : null),
    seller: seller
      ? { path: "/seller", exists: seller.exists, status: seller.config.status, mode: seller.config.mode, sellerName: seller.config.sellerName,
          ready: seller.readiness.ready, missing: seller.readiness.missing, warnings: seller.readiness.warnings }
      : null,
  };
}
