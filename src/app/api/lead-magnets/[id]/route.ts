import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRecordProject } from "@/lib/tenant";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const rec = await prisma.leadMagnet.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  const body = await req.json();
  const { name, description, funnelSlug, botUsername, baseStartParam, productId, isActive, sortOrder } = body;

  const magnet = await prisma.leadMagnet.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(funnelSlug !== undefined && { funnelSlug }),
      ...(botUsername !== undefined && { botUsername }),
      ...(baseStartParam !== undefined && { baseStartParam }),
      ...(productId !== undefined && { productId }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });

  return NextResponse.json({ ok: true, magnet });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const rec = await prisma.leadMagnet.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  await prisma.leadMagnet.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
