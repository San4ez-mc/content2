import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";

const DEFAULT_INTENT = { educate: 0.3, sell: 0.2, trust: 0.2, storytelling: 0.15, entertainment: 0.15 };

// Ф3.6 SMM-стратегія: поточна версія
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const strategy = await prisma.smmStrategy.findFirst({ where: { projectId: projectId! }, orderBy: { version: "desc" } });
  if (strategy) return NextResponse.json(strategy);
  return NextResponse.json({ projectId, contentPillars: [], intentDistribution: DEFAULT_INTENT, version: 0, isDefault: true });
}

// Нова версія стратегії
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, contentPillars, intentDistribution } = body;
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const last = await prisma.smmStrategy.findFirst({ where: { projectId }, orderBy: { version: "desc" } });
  const version = (last?.version || 0) + 1;
  const strategy = await prisma.smmStrategy.create({
    data: {
      projectId,
      contentPillars: contentPillars ?? [],
      intentDistribution: intentDistribution ?? DEFAULT_INTENT,
      version,
    },
  });
  return NextResponse.json(strategy);
}
