import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRecordProject } from "@/lib/tenant";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const item = await prisma.mediaItem.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await guardRecordProject(item.projectId);
  if (denied) return denied;

  // Delete file from disk
  try {
    const fullPath = path.join(process.cwd(), "public", item.filePath);
    await unlink(fullPath);
  } catch {}

  await prisma.mediaItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const rec = await prisma.mediaItem.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  const body = await req.json();
  const { folder, tags } = body;

  const item = await prisma.mediaItem.update({
    where: { id: params.id },
    data: {
      ...(folder !== undefined && { folder }),
      ...(tags !== undefined && { tags }),
    },
  });
  return NextResponse.json({ ok: true, item });
}
