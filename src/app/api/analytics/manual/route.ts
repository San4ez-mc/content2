import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRecordProject } from "@/lib/tenant";

// Ф3.1 Ручний ввід реакцій → перерахунок балів юніта (scores на PostGroup, Варіант A).
// Ваги — конфіг (дефолт): лайк 1, комент 2, перегляд сторіз 1, підписка 5, продаж 10.
const WEIGHTS: Record<string, number> = { likes: 1, comments: 2, storyViews: 1, subscribes: 5, sales: 10 };

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { postGroupId, reactions = {}, weights } = body as { postGroupId?: string; reactions?: Record<string, number>; weights?: Record<string, number> };
  if (!postGroupId) return NextResponse.json({ error: "postGroupId required" }, { status: 400 });

  const group = await prisma.postGroup.findUnique({ where: { id: postGroupId }, select: { id: true, scores: true, projectId: true } });
  if (!group) return NextResponse.json({ error: "postGroup not found" }, { status: 404 });
  const denied = await guardRecordProject(group.projectId);
  if (denied) return denied;

  const w = { ...WEIGHTS, ...(weights || {}) };
  const prev: Record<string, number> = (group.scores && typeof group.scores === "object" && !Array.isArray(group.scores))
    ? (group.scores as Record<string, number>) : {};

  const next: Record<string, number> = { ...prev };
  let total = Number(prev.total || 0);
  for (const k of Object.keys(w)) {
    const n = Number((reactions as Record<string, number>)[k] || 0);
    next[k] = Number(prev[k] || 0) + n;
    total += n * (w[k] || 0);
  }
  next.total = total;

  const updated = await prisma.postGroup.update({ where: { id: postGroupId }, data: { scores: next } });
  return NextResponse.json({ id: updated.id, scores: next });
}
