import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const topics = await prisma.contentTopic.findMany({
    where: { projectId: projectId! },
    orderBy: [{ rubric: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(topics);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, rubric, title, notes, platforms, status } = body;
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;
  if (!rubric || !title) {
    return NextResponse.json({ error: "rubric, title required" }, { status: 400 });
  }

  const topic = await prisma.contentTopic.create({
    data: {
      projectId,
      rubric,
      title,
      notes: notes || null,
      platforms: platforms || [],
      status: status || "idea",
    },
  });

  return NextResponse.json({ ok: true, topic });
}
