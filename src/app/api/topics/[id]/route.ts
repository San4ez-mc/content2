import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRecordProject } from "@/lib/tenant";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const rec = await prisma.contentTopic.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  const body = await req.json();
  const { rubric, title, notes, platforms, status, isActive, sortOrder } = body;

  const topic = await prisma.contentTopic.update({
    where: { id: params.id },
    data: {
      ...(rubric !== undefined && { rubric }),
      ...(title !== undefined && { title }),
      ...(notes !== undefined && { notes }),
      ...(platforms !== undefined && { platforms }),
      ...(status !== undefined && { status }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });

  return NextResponse.json({ ok: true, topic });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const rec = await prisma.contentTopic.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  await prisma.contentTopic.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
