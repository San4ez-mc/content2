import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRecordProject } from "@/lib/tenant";

type Ctx = { params: { id: string } };

// Статус ручної публікації (для вікна публікації): pending | published | failed.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const group = await prisma.postGroup.findUnique({ where: { id: params.id }, select: { projectId: true } });
  if (!group) return NextResponse.json({ ok: false, error: "Пост не знайдено" }, { status: 404 });
  const denied = await guardRecordProject(group.projectId);
  if (denied) return denied;

  const q = await prisma.publicationQueue.findUnique({ where: { postGroupId: params.id } });
  return NextResponse.json({
    ok: true,
    status: q?.status || null,
    error: q?.errorMessage || null,
    externalId: q?.externalId || null,
  });
}
