import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Ф3.2 Експерименти + анти-цементування (winning patterns)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const [experiments, patterns] = await Promise.all([
    prisma.experiment.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } }),
    prisma.winningPattern.findMany({ where: { projectId }, orderBy: { score: "desc" } }),
  ]);
  return NextResponse.json({ experiments, patterns });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { projectId, hypothesis, minPosts, metric, baseline } = body;
  if (!projectId || !hypothesis) {
    return NextResponse.json({ error: "projectId, hypothesis required" }, { status: 400 });
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
