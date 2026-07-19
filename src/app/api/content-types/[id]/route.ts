import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRecordProject } from "@/lib/tenant";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const rec = await prisma.contentType.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  const body = await req.json();
  const { name, description, prompt, tone, structure, platforms, isActive, sortOrder } = body;

  const type = await prisma.contentType.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(prompt !== undefined && { prompt }),
      ...(tone !== undefined && { tone }),
      ...(structure !== undefined && { structure }),
      ...(platforms !== undefined && { platforms }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });

  return NextResponse.json({ ok: true, type });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const rec = await prisma.contentType.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  await prisma.contentType.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
