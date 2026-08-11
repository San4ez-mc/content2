import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json([]);
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const personas = await prisma.persona.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(personas);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, name, age, gender, type, pains, goals, tone, forbiddenWords, triggers, objections, language } = body;
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const persona = await prisma.persona.create({
    data: { projectId, name, age, gender, type, pains, goals, tone, forbiddenWords, triggers, objections, language },
  });

  return NextResponse.json(persona);
}
