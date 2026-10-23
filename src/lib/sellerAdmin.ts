// Дії «адмінки продавця» (перегляд, правка, список). Викликаються з вебхука Flows (сторінка «ШІ-продавці» живе у Flows,
// content2 лише зберігає дані). Без сесійного входу: захист на роуті (x-webhook-secret).
import { prisma } from "./prisma";
import { loadBriefInput } from "./sellerBriefDb";
import { compileBrief, docMap, DOC, DOC_PREFIX, type BriefInput } from "./sellerBrief";
import { sanitizeConfigInput } from "./sellerConfigInput";

export async function sellerAdminView(projectId: string) {
  const input = await loadBriefInput(projectId);
  if (!input) return null;
  const brief = compileBrief(input);
  const docs = docMap(input.docs);
  const c = input.config;
  return {
    exists: !!c,
    projectId, projectName: input.project.name,
    config: {
      status: c?.status || "draft", mode: c?.mode || "book_consult",
      sellerName: c?.sellerName || "", sellerTitle: c?.sellerTitle || "",
      primaryProductId: c?.primaryProductId || "", bookingUrl: c?.bookingUrl || "", bookingNote: c?.bookingNote || "",
      handoffTelegramId: c?.handoffTelegramId || "", allowedContacts: c?.allowedContacts || "",
      priceAmount: c?.priceAmount ?? "", currency: c?.currency || "UAH", paymentConnectorId: c?.paymentConnectorId || "",
      monthlyDialogLimit: c?.monthlyDialogLimit ?? "", testAllowlist: Array.isArray(c?.testAllowlist) ? c!.testAllowlist : [],
      texts: c?.texts && typeof c.texts === "object" ? c.texts : {},
      funnelBotId: c?.funnelBotId || "", templateVersion: c?.templateVersion || "", goLiveAt: c?.goLiveAt || null,
    },
    products: input.products.map((p) => ({ id: p.id, name: p.name, price: p.price || "" })),
    readiness: brief.readiness,
    hints: { booking: docs[DOC.booking]?.value || "", notify: docs[DOC.notify]?.value || "", name: docs[DOC.name]?.value || "" },
    defaultDirections: brief.directions,
    preview: { offer: brief.blocks.offer, proof: brief.blocks.proof, rules: brief.blocks.rules, tone: brief.blocks.tone, faq: brief.blocks.faq, qualify: brief.blocks.qualify, booking: brief.blocks.booking },
  };
}

export async function sellerAdminList() {
  const ids = new Set<string>();
  for (const r of await prisma.sellerConfig.findMany({ select: { projectId: true } })) ids.add(r.projectId);
  for (const r of await prisma.knowledgeEntry.findMany({ where: { title: { startsWith: DOC_PREFIX } }, select: { projectId: true }, distinct: ["projectId"] })) ids.add(r.projectId);
  const out = [];
  for (const id of Array.from(ids)) {
    const input = await loadBriefInput(id);
    if (!input) continue;
    const b = compileBrief(input);
    out.push({
      projectId: id, projectName: input.project.name, status: b.status, mode: b.mode,
      sellerName: b.expert.sellerName, ready: b.readiness.ready, missing: b.readiness.missing.length, warnings: b.readiness.warnings.length,
      funnelBotId: input.config?.funnelBotId || "",
    });
  }
  return out.sort((a, b) => a.projectName.localeCompare(b.projectName));
}

export type ApplyResult = { ok: true; status: string; readiness: ReturnType<typeof compileBrief>["readiness"] } | { ok: false; error: string; code: number; missing?: string[] };

/** Зберегти налаштування. Запуск (live) лише коли бриф готовий (перевірка на ЗЛИТТІ старого й нового). */
export async function sellerAdminApply(projectId: string, body: Record<string, unknown>): Promise<ApplyResult> {
  const input = await loadBriefInput(projectId);
  if (!input) return { ok: false, error: "Проєкт не знайдено", code: 404 };
  const clean = sanitizeConfigInput(body);
  if (!clean.ok) return { ok: false, error: clean.error, code: 400 };
  const patch = clean.data;
  const merged = { ...(input.config || { status: "draft", mode: "book_consult", sellerName: "", sellerTitle: "" }), ...patch } as NonNullable<BriefInput["config"]>;
  const after = compileBrief({ ...input, config: merged });
  if (patch.status === "live" && !after.readiness.ready) {
    return { ok: false, error: "Не можна запустити: " + after.readiness.missing.join("; "), code: 400, missing: after.readiness.missing };
  }
  if (patch.primaryProductId && !input.products.some((p) => p.id === patch.primaryProductId)) {
    return { ok: false, error: "Обраної послуги немає в цьому проєкті", code: 400 };
  }
  const wasLive = input.config?.status === "live";
  const data = { ...patch, ...(patch.status === "live" && !wasLive && !input.config?.goLiveAt ? { goLiveAt: new Date() } : {}) };
  const saved = await prisma.sellerConfig.upsert({ where: { projectId }, create: { projectId, ...data }, update: data });
  return { ok: true, status: saved.status, readiness: after.readiness };
}
