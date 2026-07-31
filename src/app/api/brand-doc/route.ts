import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";

// GET /api/brand-doc?projectId=...&section=all|brand|persona|product|strategy|case
// Бренд-профіль компанії у .docx. section дозволяє качати окрему «статтю».
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const section = (req.nextUrl.searchParams.get("section") || "all").toLowerCase();
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const want = (s: string) => section === "all" || section === s;

  const [project, products, personas, strategy, brand, cases] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId! } }),
    want("product") ? prisma.product.findMany({ where: { projectId: projectId! }, orderBy: { sortOrder: "asc" }, include: { leadMagnets: true } }) : Promise.resolve([]),
    want("persona") ? prisma.persona.findMany({ where: { projectId: projectId! } }) : Promise.resolve([]),
    want("strategy") ? prisma.smmStrategy.findFirst({ where: { projectId: projectId! }, orderBy: { version: "desc" } }) : Promise.resolve(null),
    want("brand") ? prisma.knowledgeEntry.findMany({ where: { projectId: projectId!, category: "brand", isActive: true } }) : Promise.resolve([]),
    want("case") ? prisma.case.findMany({ where: { projectId: projectId! }, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
  ]);

  const H1 = (t: string) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1 });
  const H2 = (t: string) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2 });
  const P = (t: string) => new Paragraph({ children: [new TextRun(String(t || ""))] });

  const titleMap: Record<string, string> = {
    all: "Бренд-профіль", brand: "Бренд і Tone of Voice", persona: "Персони (ЦА)",
    product: "Продукти", strategy: "SMM-стратегія", case: "Кейси",
  };
  const children: Paragraph[] = [new Paragraph({ text: `${titleMap[section] || "Дані"}: ${project?.name || ""}`, heading: HeadingLevel.TITLE })];

  if (want("product")) {
    children.push(H1("Продукти"));
    if (products.length) for (const p of products as any[]) {
      children.push(H2(p.name));
      if (p.price) children.push(P(`Ціна: ${p.price}`));
      if (p.audience) children.push(P(`Цільова аудиторія: ${p.audience}`));
      if (p.description) children.push(P(p.description));
      if (p.pains) children.push(P(`Болі, які закриває: ${p.pains}`));
      if (p.transformation) children.push(P(`Трансформація: ${p.transformation}`));
      if (p.benefits) children.push(P(`Переваги: ${p.benefits}`));
      if (p.leadMagnets?.length) children.push(P(`Лід-магніти: ${p.leadMagnets.map((m: any) => m.name).join(", ")}`));
    } else children.push(P("—"));
  }

  if (want("persona")) {
    children.push(H1("Персони (ЦА) і тон голосу"));
    if (personas.length) for (const p of personas as any[]) {
      children.push(H2(p.name));
      if (p.age) children.push(P(`Вік: ${p.age}`));
      if (p.tone) children.push(P(`Тон голосу: ${p.tone}`));
      if (p.forbiddenWords) children.push(P(`Уникати: ${p.forbiddenWords}`));
      if (p.pains) children.push(P(`Болі: ${p.pains}`));
      if (p.goals) children.push(P(`Цілі/мрії: ${p.goals}`));
      if (p.triggers) children.push(P(`Тригери: ${p.triggers}`));
      if (p.objections) children.push(P(`Заперечення: ${p.objections}`));
      if (p.language) children.push(P(`Мова: ${p.language}`));
    } else children.push(P("—"));
  }

  if (want("brand")) {
    children.push(H1("Бренд і Tone of Voice"));
    if (brand.length) for (const b of brand as any[]) { children.push(H2(b.title)); children.push(P(b.content)); }
    else children.push(P("—"));
  }

  if (want("case")) {
    children.push(H1("Кейси"));
    if (cases.length) for (const c of cases as any[]) {
      children.push(H2(c.title));
      if (c.niche) children.push(P(`Ніша: ${c.niche}`));
      if (c.problem) children.push(P(`Проблема: ${c.problem}`));
      if (c.solution) children.push(P(`Рішення: ${c.solution}`));
      const m = c.metrics && typeof c.metrics === "object" ? c.metrics as Record<string, any> : {};
      const mStr = Object.entries(m).map(([k, v]) => `${k}: ${v}`).join(", ");
      if (mStr) children.push(P(`Результати: ${mStr}`));
      if (c.allowedClaims) children.push(P(`Дозволені формулювання: ${c.allowedClaims}`));
    } else children.push(P("—"));
  }

  if (want("strategy")) {
    children.push(H1("SMM-стратегія"));
    if (strategy) {
      const pillars = Array.isArray((strategy as any).contentPillars) ? ((strategy as any).contentPillars as any[]) : [];
      children.push(P(`Контент-стовпи: ${pillars.join(", ") || "—"}`));
      const intent = ((strategy as any).intentDistribution && typeof (strategy as any).intentDistribution === "object") ? (strategy as any).intentDistribution as Record<string, any> : {};
      children.push(P(`Баланс цілей: ${Object.entries(intent).map(([k, v]) => `${k} ${v}`).join(", ") || "—"}`));
    } else children.push(P("—"));
  }

  const doc = new Document({ sections: [{ children }] });
  const buf = await Packer.toBuffer(doc);
  const fname = section === "all" ? "brand-profile.docx" : `${section}.docx`;
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
