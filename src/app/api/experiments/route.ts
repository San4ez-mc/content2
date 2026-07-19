import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";

// Ф3.2 Експерименти + анти-цементування (winning patterns)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const [experiments, patterns] = await Promise.all([
    prisma.experiment.findMany({ where: { projectId: projectId! }, orderBy: { createdAt: "desc" } }),
    prisma.winningPattern.findMany({ where: { projectId: projectId! }, orderBy: { score: "desc" } }),
  ]);
  return NextResponse.json({ experiments, patterns });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, hypothesis, minPosts, metric, baseline } = body;
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;
  if (!hypothesis) {
    return NextResponse.json({ error: "hypothesis required" }, { status: 400 });
  }

  // Ф3.2: не більше 3 активних експериментів одночасно
  const activeCount = await prisma.experiment.count({ where: { projectId, status: "testing" } });
  if (activeCount >= 3) {
    return NextResponse.json({ error: "Максимум 3 активні експерименти одночасно" }, { status: 422 });
  }

  const experiment = await prisma.experiment.create({
    data: {
      projectId,
      hypothesis,
      minPosts: minPosts ?? 5,
      metric: metric ?? null,
      baseline: baseline ?? null,
    },
  });
  return NextResponse.json(experiment);
}
