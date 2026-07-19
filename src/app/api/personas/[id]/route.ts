import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRecordProject } from "@/lib/tenant";

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const rec = await prisma.persona.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  const body = await req.json();
  // не дозволяємо переносити запис в інший проєкт через body
  delete body.projectId;
  const persona = await prisma.persona.update({
    where: { id: params.id },
    data: body,
  });

  return NextResponse.json(persona);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const rec = await prisma.persona.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  await prisma.persona.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
