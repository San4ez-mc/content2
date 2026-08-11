import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRecordProject } from "@/lib/tenant";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const rec = await prisma.structure.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  const body = await req.json();
  const { name, description, prompt, tone, structure, platforms, postTypes, hookTypes, skeletonKey, minLen, maxLen, rules, isActive, sortOrder } = body;

  const type = await prisma.structure.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(prompt !== undefined && { prompt }),
      ...(tone !== undefined && { tone }),
      ...(structure !== undefined && { structure }),
      ...(platforms !== undefined && { platforms }),
      ...(postTypes !== undefined && { postTypes }),
      ...(hookTypes !== undefined && { hookTypes }),
      ...(skeletonKey !== undefined && { skeletonKey: skeletonKey || null }),
      ...(minLen !== undefined && { minLen: minLen === null ? null : Number(minLen) }),
      ...(maxLen !== undefined && { maxLen: maxLen === null ? null : Number(maxLen) }),
      ...(rules !== undefined && { rules }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });

  return NextResponse.json({ ok: true, type });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const rec = await prisma.structure.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  await prisma.structure.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
