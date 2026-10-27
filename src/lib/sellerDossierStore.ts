// Сховище досьє експерта (анкети онбордингу ШІ-продавця). Єдине джерело правди — таблиця seller_dossiers у content2.
// Flows (воронка onboard-seller) читає й пише її через вебхук /api/webhooks/seller-dossier і більше нічого не зберігає.
import { prisma } from "./prisma";
import { seedDefaultStructures, seedDefaultSocialNetworks } from "./seedStructures";

/** Знайти проєкт за id або назвою; якщо нема й дано назву, створити (з типовими структурами й каналами, як онбординг-save). */
export async function ensureExpertProject(opts: { projectId?: string; projectName?: string; create?: boolean }) {
  let project = opts.projectId ? await prisma.project.findUnique({ where: { id: opts.projectId } }) : null;
  if (!project && opts.projectName) project = await prisma.project.findFirst({ where: { name: opts.projectName } });
  if (!project && opts.create && opts.projectName) {
    project = await prisma.project.create({ data: { name: opts.projectName } });
    await seedDefaultStructures(project.id).catch(() => {});
    await seedDefaultSocialNetworks(project.id).catch(() => {});
  }
  return project;
}

export async function getDossier(projectId: string) {
  const row = await prisma.sellerDossier.findUnique({ where: { projectId } });
  return row ? { state: row.state as Record<string, unknown>, updatedAt: row.updatedAt } : null;
}

export async function putDossier(projectId: string, state: Record<string, unknown>) {
  const row = await prisma.sellerDossier.upsert({
    where: { projectId },
    create: { projectId, state: state as object },
    update: { state: state as object },
  });
  return { updatedAt: row.updatedAt };
}

/** Короткий підсумок для «Бази знань» у Flows: скільки критичних полів закрито, скільки розмито, чи є запити до фахівця. */
export function dossierSummary(state: Record<string, unknown> | null | undefined) {
  const fields = (state && typeof state === "object" && (state as { fields?: Record<string, { status?: string; quality?: { weak?: boolean } }> }).fields) || {};
  const crit = ["K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8", "K9", "K10", "K11"];
  const closed = crit.filter((id) => ["confirmed", "not_applicable"].includes(fields[id]?.status || "")).length;
  const fromMaterials = crit.filter((id) => fields[id]?.status === "from_materials").length;
  const weak = Object.values(fields).filter((f) => f?.quality?.weak).length;
  const requests = Array.isArray((state as { specialistRequests?: unknown[] } | null)?.specialistRequests) ? ((state as { specialistRequests: unknown[] }).specialistRequests.length) : 0;
  return { critical: crit.length, closed, fromMaterials, weak, specialistRequests: requests, started: Object.keys(fields).length > 0 };
}
