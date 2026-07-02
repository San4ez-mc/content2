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
  const search = (searchParams.get("search") || "").trim();

  if (!projectId) return NextResponse.json([]);

  const include = {
    items: { orderBy: { orderIndex: "asc" as const } },
    socialNetwork: true,
    category: true,
    persona: true,
  };

  // Search mode — across ALL months. Matches post text, slide texts, or post number.
  if (search) {
    const num = /^#?\d+$/.test(search) ? parseInt(search.replace("#", ""), 10) : undefined;
    const postGroups = await prisma.postGroup.findMany({
      where: {
        projectId,
        OR: [
          { items: { some: { content: { contains: search, mode: "insensitive" } } } },
          { items: { some: { slideTitle: { contains: search, mode: "insensitive" } } } },
          { items: { some: { slideSubtitle: { contains: search, mode: "insensitive" } } } },
          ...(num !== undefined ? [{ number: num }] : []),
        ],
      },
      include,
      orderBy: { postDate: "desc" },
      take: 100,
    });
    return NextResponse.json(postGroups);
  }

  if (!month) return NextResponse.json([]);

  const [year, mon] = month.split("-").map(Number);
  const dateFrom = new Date(year, mon - 1, 1);
  const dateTo = new Date(year, mon, 0);

  const postGroups = await prisma.postGroup.findMany({
    where: { projectId, postDate: { gte: dateFrom, lte: dateTo } },
    include,
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
