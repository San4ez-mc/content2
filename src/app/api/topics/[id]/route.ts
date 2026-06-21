import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { rubric, title, notes, platforms, status, isActive, sortOrder } = body;

  const topic = await prisma.contentTopic.update({
    where: { id: params.id },
    data: {
      ...(rubric !== undefined && { rubric }),
      ...(title !== undefined && { title }),
      ...(notes !== undefined && { notes }),
      ...(platforms !== undefined && { platforms }),
      ...(status !== undefined && { status }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });

  return NextResponse.json({ ok: true, topic });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.contentTopic.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
