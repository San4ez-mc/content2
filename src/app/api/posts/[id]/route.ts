import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRecordProject } from "@/lib/tenant";
import { broadcastToProject } from "@/lib/sse";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const group = await prisma.postGroup.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { orderIndex: "asc" } }, socialNetwork: true, category: true, persona: true },
  });

  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await guardRecordProject(group.projectId);
  if (denied) return denied;

  return NextResponse.json(group);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const existing = await prisma.postGroup.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(existing?.projectId);
  if (denied) return denied;

  const body = await req.json();
  const { status, audience, scheduleTime, categoryId, personaId, postDate, items, formatKey, topic,
    intent, structureId, evidenceType, hookA, hookB, hookSelected, cta } = body; // #248 конструктор

  // Update group fields
  const group = await prisma.postGroup.update({
    where: { id: params.id },
    data: {
      ...(status !== undefined && { status }),
      ...(audience !== undefined && { audience }),
      ...(scheduleTime !== undefined && { scheduleTime }),
      ...(categoryId !== undefined && { categoryId }),
      ...(personaId !== undefined && { personaId }),
      ...(postDate !== undefined && { postDate: new Date(postDate) }),
      // #248 атоми конструктора
      ...(formatKey !== undefined && { formatKey: formatKey || null }),
      ...(topic !== undefined && { topic: topic || null }),
      ...(intent !== undefined && { intent: intent || null }),
      ...(structureId !== undefined && { structureId: structureId || null }),
      ...(evidenceType !== undefined && { evidenceType: evidenceType || null }),
      ...(hookA !== undefined && { hookA: hookA || null }),
      ...(hookB !== undefined && { hookB: hookB || null }),
      ...(hookSelected !== undefined && { hookSelected: hookSelected || null }),
      ...(cta !== undefined && { cta: cta || null }),
    },
    include: { socialNetwork: true },
  });

  // Update items if provided — scoped by groupId, щоб не можна було правити чужі айтеми за id
  if (items && Array.isArray(items)) {
    for (const item of items) {
      await prisma.postItem.updateMany({
        where: { id: item.id, groupId: params.id },
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
  const group = await prisma.postGroup.findUnique({ where: { id: params.id } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await guardRecordProject(group.projectId);
  if (denied) return denied;

  await prisma.postGroup.delete({ where: { id: params.id } });

  broadcastToProject(group.projectId, { type: "post_deleted", postGroupId: params.id });

  return NextResponse.json({ ok: true });
}
