import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";

// Ф1.8 Журнал правок (local/global + категорія)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const edits = await prisma.editLog.findMany({
    where: { projectId: projectId! },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(edits);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, scope = "local", category, unitId, text } = body;
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const edit = await prisma.editLog.create({
    data: {
      projectId,
      scope: scope === "global" ? "global" : "local",
      category: category ?? null,
      unitId: unitId ?? null,
      text,
    },
  });
  return NextResponse.json(edit);
}
