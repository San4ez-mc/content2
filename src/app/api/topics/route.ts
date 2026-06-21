import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const topics = await prisma.contentTopic.findMany({
    where: { projectId },
    orderBy: [{ rubric: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(topics);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { projectId, rubric, title, notes, platforms, status } = body;

  if (!projectId || !rubric || !title) {
    return NextResponse.json({ error: "projectId, rubric, title required" }, { status: 400 });
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
