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

  const types = await prisma.contentType.findMany({
    where: { projectId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(types);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { projectId, name, description, prompt, tone, structure, platforms } = body;

  if (!projectId || !name || !prompt) {
    return NextResponse.json({ error: "projectId, name, prompt required" }, { status: 400 });
  }

  const type = await prisma.contentType.create({
    data: {
      projectId,
      name,
      description: description || null,
      prompt,
      tone: tone || null,
      structure: structure || null,
      platforms: platforms || [],
    },
  });

  return NextResponse.json({ ok: true, type });
}
