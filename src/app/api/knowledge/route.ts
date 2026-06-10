import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const category = searchParams.get("category");
  const activeOnly = searchParams.get("activeOnly") !== "false";

  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const entries = await prisma.knowledgeEntry.findMany({
    where: {
      projectId,
      ...(category ? { category } : {}),
      ...(activeOnly ? { isActive: true } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { projectId, category = "general", title, content } = body;

  if (!projectId || !title || !content) {
    return NextResponse.json({ error: "projectId, title, content required" }, { status: 400 });
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
