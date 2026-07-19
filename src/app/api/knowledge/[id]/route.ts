import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRecordProject } from "@/lib/tenant";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const rec = await prisma.knowledgeEntry.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  const body = await req.json();
  const entry = await prisma.knowledgeEntry.update({
    where: { id: params.id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });

  return NextResponse.json(entry);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const rec = await prisma.knowledgeEntry.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  await prisma.knowledgeEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
