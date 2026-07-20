import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";

// #248 Бали ефективності елементів — рахуємо на льоту з реальних результатів постів.
// Для кожного значення елемента (intent/structureId/evidenceType) — середній scores.total
// по опублікованих постах, що його мали, + розмір вибірки. Поріг довіри — MIN_SAMPLE.
const MIN_SAMPLE = 3;
const ELEMENTS = ["intent", "structureId", "evidenceType"] as const;

function totalOf(scores: unknown): number | null {
  if (scores && typeof scores === "object" && !Array.isArray(scores)) {
    const t = (scores as Record<string, unknown>).total;
    if (typeof t === "number") return t;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const groups = await prisma.postGroup.findMany({
    where: { projectId: projectId!, status: { in: ["published", "scheduled"] } },
    select: { intent: true, structureId: true, evidenceType: true, scores: true },
  });

  // acc[element][value] = { sum, n }
  const acc: Record<string, Record<string, { sum: number; n: number }>> = {};
  for (const el of ELEMENTS) acc[el] = {};

  for (const g of groups) {
    const total = totalOf(g.scores);
    if (total == null) continue;
    for (const el of ELEMENTS) {
      const v = (g as any)[el] as string | null;
      if (!v) continue;
      const bucket = (acc[el][v] ||= { sum: 0, n: 0 });
      bucket.sum += total;
      bucket.n += 1;
    }
  }

  // → element → value → { score(avg), n, enough }
  const out: Record<string, Record<string, { score: number; n: number; enough: boolean }>> = {};
  for (const el of ELEMENTS) {
    out[el] = {};
    for (const [v, b] of Object.entries(acc[el])) {
      out[el][v] = { score: b.n ? Math.round((b.sum / b.n) * 10) / 10 : 0, n: b.n, enough: b.n >= MIN_SAMPLE };
    }
  }

  return NextResponse.json({ minSample: MIN_SAMPLE, elements: out });
}
