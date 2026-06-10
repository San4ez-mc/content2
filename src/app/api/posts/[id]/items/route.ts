import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { id: string } };

// POST — add new item to a post group
export async function POST(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const group = await prisma.postGroup.findUnique({
    where: { id: params.id },
    include: { items: true },
  });

  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nextIndex = group.items.length;

  const newItem = await prisma.postItem.create({
    data: {
      groupId: params.id,
      orderIndex: nextIndex,
      isCta: false,
      generationStatus: "pending",
    },
  });

  return NextResponse.json(newItem);
}

// DELETE — remove specific item
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const itemId = searchParams.get("itemId");

  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  await prisma.postItem.delete({ where: { id: itemId } });

  // Re-index remaining items
  const remaining = await prisma.postItem.findMany({
    where: { groupId: params.id },
    orderBy: { orderIndex: "asc" },
  });

  for (let i = 0; i < remaining.length; i++) {
    await prisma.postItem.update({
      where: { id: remaining[i].id },
      data: { orderIndex: i },
    });
  }

  return NextResponse.json({ ok: true });
}
