import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { resolveActiveProject } from "@/lib/tenant";
import { UserDataView } from "@/components/user-data/UserDataView";

export const metadata = { title: "Дані користувача" };

export default async function UserDataPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const { user, activeProject } = await resolveActiveProject(searchParams.projectId);
  if (!user) redirect("/login");
  if (!activeProject) redirect("/");
  const projectId = activeProject.id;

  const [project, brand, personas, products, cases, strategy, topicsCount] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.knowledgeEntry.findMany({ where: { projectId, isActive: true }, orderBy: { updatedAt: "desc" } }),
    prisma.persona.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.product.findMany({ where: { projectId }, orderBy: { sortOrder: "asc" }, include: { leadMagnets: true } }),
    prisma.case.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.smmStrategy.findFirst({ where: { projectId }, orderBy: { version: "desc" } }),
    prisma.contentTopic.count({ where: { projectId } }),
  ]);

  // Сирі завантажені документи (джерело) відділяємо від канонічного бренд-гайду:
  // вони вже розібрані в структуру (продукти/персони/кейси) і НЕ є базою генерації.
  const isSourceDoc = (c: string) => c.startsWith("onboarding-doc");

  // Серіалізуємо у прості обʼєкти для клієнта
  const data = {
    projectId,
    projectName: project?.name || "",
    brand: brand.filter((b) => !isSourceDoc(b.category)).map((b) => ({ id: b.id, category: b.category, title: b.title, content: b.content, updatedAt: b.updatedAt.toISOString() })),
    sourceDocs: brand.filter((b) => isSourceDoc(b.category)).map((b) => ({ id: b.id, category: b.category, title: b.title, content: b.content, updatedAt: b.updatedAt.toISOString() })),
    personas: personas.map((p) => ({ id: p.id, name: p.name, age: p.age, gender: p.gender, type: p.type, pains: p.pains, goals: p.goals, tone: p.tone, forbiddenWords: p.forbiddenWords, triggers: p.triggers, objections: p.objections, language: p.language })),
    products: products.map((p) => ({ id: p.id, name: p.name, description: p.description, price: p.price, audience: p.audience, pains: p.pains, transformation: p.transformation, benefits: p.benefits, priority: p.priority, leadMagnets: p.leadMagnets.map((m) => ({ id: m.id, name: m.name })) })),
    cases: cases.map((c) => ({ id: c.id, title: c.title, niche: c.niche, problem: c.problem, solution: c.solution, metrics: c.metrics as any, allowedClaims: c.allowedClaims })),
    strategy: strategy
      ? { version: strategy.version, contentPillars: strategy.contentPillars as any, intentDistribution: strategy.intentDistribution as any }
      : null,
    topicsCount,
  };

  return <UserDataView data={data} />;
}
