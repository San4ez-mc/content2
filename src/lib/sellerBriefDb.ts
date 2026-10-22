// Завантаження даних проєкту для брифу ШІ-продавця (БД-шар; чиста логіка — sellerBrief.ts).
import { prisma } from "./prisma";
import { allFacts } from "./factsDb";
import { compileBrief, DOC_PREFIX, type BriefInput, type Brief } from "./sellerBrief";

export async function loadBriefInput(projectId: string): Promise<BriefInput | null> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } });
  if (!project) return null;
  const [config, products, cases, personas, founder, docs, facts] = await Promise.all([
    prisma.sellerConfig.findUnique({ where: { projectId } }),
    prisma.product.findMany({ where: { projectId, isActive: true }, orderBy: [{ priority: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.case.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.persona.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.founderProfile.findUnique({ where: { projectId } }),
    prisma.knowledgeEntry.findMany({ where: { projectId, isActive: true, title: { startsWith: DOC_PREFIX } }, select: { title: true, content: true } }),
    allFacts(projectId),
  ]);
  return { project, config, products, cases, personas, founder, docs, facts } as BriefInput;
}

export async function buildBrief(projectId: string, telegramId?: string | null): Promise<Brief | null> {
  const input = await loadBriefInput(projectId);
  return input ? compileBrief(input, telegramId) : null;
}
