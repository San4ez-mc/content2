import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Ф1.8 Журнал правок (local/global + категорія)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const edits = await prisma.editLog.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(edits);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { projectId, scope = "local", category, unitId, text } = body;
  if (!projectId || !text) {
    return NextResponse.json({ error: "projectId, text required" }, { status: 400 });
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
