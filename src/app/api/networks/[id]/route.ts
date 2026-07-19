import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRecordProject } from "@/lib/tenant";

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const rec = await prisma.socialNetwork.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  const body = await req.json();
  delete body.projectId; // не дозволяємо переносити мережу в інший проєкт
  const network = await prisma.socialNetwork.update({
    where: { id: params.id },
    data: body,
  });

  return NextResponse.json(network);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const rec = await prisma.socialNetwork.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  await prisma.socialNetwork.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
