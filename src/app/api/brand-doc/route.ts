import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";

// GET /api/brand-doc?projectId=... — бренд-профіль компанії у .docx (продукти/персони/ToV/стратегія).
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const [project, products, personas, strategy, brand] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId! } }),
    prisma.product.findMany({ where: { projectId: projectId! }, orderBy: { sortOrder: "asc" } }),
    prisma.persona.findMany({ where: { projectId: projectId! } }),
    prisma.smmStrategy.findFirst({ where: { projectId: projectId! }, orderBy: { version: "desc" } }),
    prisma.knowledgeEntry.findMany({ where: { projectId: projectId!, category: "brand", isActive: true } }),
  ]);

  const H1 = (t: string) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1 });
  const H2 = (t: string) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2 });
  const P = (t: string) => new Paragraph({ children: [new TextRun(String(t || ""))] });

  const children: Paragraph[] = [new Paragraph({ text: `Бренд-профіль: ${project?.name || ""}`, heading: HeadingLevel.TITLE })];

  children.push(H1("Продукти"));
  if (products.length) for (const p of products) {
    children.push(H2(p.name));
    if (p.price) children.push(P(`Ціна: ${p.price}`));
    if (p.audience) children.push(P(`Цільова аудиторія: ${p.audience}`));
    if (p.description) children.push(P(p.description));
  } else children.push(P("—"));

  children.push(H1("Персони (ЦА) і тон голосу"));
  if (personas.length) for (const p of personas) {
    children.push(H2(p.name));
    if (p.tone) children.push(P(`Тон голосу: ${p.tone}`));
    if (p.forbiddenWords) children.push(P(`Уникати: ${p.forbiddenWords}`));
    if (p.pains) children.push(P(`Болі: ${p.pains}`));
    if (p.goals) children.push(P(`Цілі/мрії: ${p.goals}`));
  } else children.push(P("—"));

  children.push(H1("Бренд і Tone of Voice"));
  if (brand.length) for (const b of brand) { children.push(H2(b.title)); children.push(P(b.content)); }
  else children.push(P("—"));

  children.push(H1("SMM-стратегія"));
  if (strategy) {
    const pillars = Array.isArray(strategy.contentPillars) ? (strategy.contentPillars as any[]) : [];
    children.push(P(`Контент-стовпи: ${pillars.join(", ") || "—"}`));
    const intent = (strategy.intentDistribution && typeof strategy.intentDistribution === "object") ? strategy.intentDistribution as Record<string, any> : {};
    children.push(P(`Баланс цілей: ${Object.entries(intent).map(([k, v]) => `${k} ${v}`).join(", ") || "—"}`));
  } else children.push(P("—"));

  const doc = new Document({ sections: [{ children }] });
  const buf = await Packer.toBuffer(doc);
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="brand-profile.docx"`,
    },
  });
}
