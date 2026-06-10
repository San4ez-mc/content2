import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Called by the flows bot when it detects a rule/correction to save
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { projectId, category = "general", title, content } = body;

  if (!projectId || !title || !content) {
    return NextResponse.json({ error: "projectId, title, content required" }, { status: 400 });
  }

  // Check for duplicate (same title in same project)
  const existing = await prisma.knowledgeEntry.findFirst({
    where: { projectId, title: { equals: title, mode: "insensitive" } },
  });

  if (existing) {
    // Update content if duplicate
    const updated = await prisma.knowledgeEntry.update({
      where: { id: existing.id },
      data: { content, category, isActive: true },
    });
    return NextResponse.json({ action: "updated", entry: updated });
  }

  const entry = await prisma.knowledgeEntry.create({
    data: { projectId, category, title, content, addedBy: "bot" },
  });

  return NextResponse.json({ action: "created", entry });
}
