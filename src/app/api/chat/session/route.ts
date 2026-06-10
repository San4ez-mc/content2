import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");

  // Get user's first project if not specified
  let pid: string | null = projectId ?? null;
  if (!pid) {
    const pu = await prisma.projectUser.findFirst({ where: { userId } });
    pid = pu?.projectId ?? null;
    if (!pid) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.role === "superadmin") {
        const p = await prisma.project.findFirst();
        pid = p?.id ?? null;
      }
    }
  }

  if (!pid) return NextResponse.json({ error: "No project" }, { status: 400 });

  // Find or create chat session
  let chatSession = await prisma.chatSession.findFirst({
    where: { userId, projectId: pid },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } },
    orderBy: { lastActivity: "desc" },
  });

  if (!chatSession) {
    chatSession = await prisma.chatSession.create({
      data: {
        userId,
        projectId: pid,
        sessionKey: crypto.randomUUID(),
      },
      include: { messages: true },
    });
  }

  return NextResponse.json({
    sessionKey: chatSession.sessionKey,
    messages: chatSession.messages,
  });
}
