import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.leadMagnet.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
