import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRecordProject } from "@/lib/tenant";

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const rec = await prisma.category.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  const body = await req.json();
  const { name, color, description, clientType, socialNetworkId } = body;

  const category = await prisma.category.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(color !== undefined && { color }),
      ...(description !== undefined && { description }),
      ...(clientType !== undefined && { clientType }),
      ...(socialNetworkId !== undefined && { socialNetworkId }),
    },
    include: { socialNetwork: true },
  });

  return NextResponse.json(category);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const rec = await prisma.category.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  await prisma.category.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
