import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const category = searchParams.get("category");
  const activeOnly = searchParams.get("activeOnly") !== "false";
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const entries = await prisma.knowledgeEntry.findMany({
    where: {
      projectId: projectId!,
      ...(category ? { category } : {}),
      ...(activeOnly ? { isActive: true } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, category = "general", title, content } = body;
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;
  if (!title || !content) {
    return NextResponse.json({ error: "title, content required" }, { status: 400 });
  }

  const entry = await prisma.knowledgeEntry.create({
    data: {
      projectId,
      category,
      title,
      content,
      addedBy: "user",
    },
  });

  return NextResponse.json(entry);
}
