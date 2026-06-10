import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastToProject } from "@/lib/sse";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const group = await prisma.postGroup.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { orderIndex: "asc" } }, socialNetwork: true, category: true, persona: true },
  });

  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(group);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { status, audience, scheduleTime, categoryId, personaId, items } = body;

  // Update group fields
  const group = await prisma.postGroup.update({
    where: { id: params.id },
    data: {
      ...(status !== undefined && { status }),
      ...(audience !== undefined && { audience }),
      ...(scheduleTime !== undefined && { scheduleTime }),
      ...(categoryId !== undefined && { categoryId }),
      ...(personaId !== undefined && { personaId }),
    },
    include: { socialNetwork: true },
  });

  // Update items if provided
  if (items && Array.isArray(items)) {
    for (const item of items) {
      await prisma.postItem.update({
        where: { id: item.id },
        data: {
          content: item.content,
          imagePrompt: item.imagePrompt,
          imageType: item.imageType,
          isCta: item.isCta,
          slideTitle: item.slideTitle,
          slideSubtitle: item.slideSubtitle,
        },
      });
    }
  }

  broadcastToProject(group.projectId, { type: "post_updated", postGroupId: params.id });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const group = await prisma.postGroup.findUnique({ where: { id: params.id } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.postGroup.delete({ where: { id: params.id } });

  broadcastToProject(group.projectId, { type: "post_deleted", postGroupId: params.id });

  return NextResponse.json({ ok: true });
}
