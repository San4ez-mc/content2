import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRecordProject } from "@/lib/tenant";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const rec = await prisma.format.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  const body = await req.json();
  const { name, mediaTypes, aspect, settings, isActive, sortOrder } = body;
  const fmt = await prisma.format.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(mediaTypes !== undefined && { mediaTypes }),
      ...(aspect !== undefined && { aspect: aspect || null }),
      ...(settings !== undefined && { settings }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });
  return NextResponse.json(fmt);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const rec = await prisma.format.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;
  await prisma.format.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
