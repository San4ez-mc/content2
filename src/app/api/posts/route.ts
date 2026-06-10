import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");
  const month = searchParams.get("month"); // YYYY-MM

  if (!projectId || !month) return NextResponse.json([]);

  const [year, mon] = month.split("-").map(Number);
  const dateFrom = new Date(year, mon - 1, 1);
  const dateTo = new Date(year, mon, 0);

  const postGroups = await prisma.postGroup.findMany({
    where: { projectId, postDate: { gte: dateFrom, lte: dateTo } },
    include: {
      items: { orderBy: { orderIndex: "asc" } },
      socialNetwork: true,
      category: true,
      persona: true,
    },
    orderBy: { postDate: "asc" },
  });

  return NextResponse.json(postGroups);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { projectId, socialNetworkId, postDate, type, status, content, categoryId, personaId, scheduleTime } = body;

  const group = await prisma.postGroup.create({
    data: {
      projectId,
      socialNetworkId,
      postDate: new Date(postDate),
      type: type || "single",
      status: status || "draft",
      ...(categoryId && { categoryId }),
      ...(personaId && { personaId }),
      ...(scheduleTime && { scheduleTime }),
      items: {
        create: [{ orderIndex: 0, content: content || "", isCta: false }],
      },
    },
    include: { items: true, socialNetwork: true },
  });

  return NextResponse.json(group);
}
