import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.mediaItem.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete file from disk
  try {
    const fullPath = path.join(process.cwd(), "public", item.filePath);
    await unlink(fullPath);
  } catch {}

  await prisma.mediaItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
