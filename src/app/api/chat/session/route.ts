import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, canAccessProject, resolveActiveProject } from "@/lib/tenant";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const sUser = await getSessionUser();
  if (!sUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = sUser.id;
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");

  // Якщо проєкт задано клієнтом — перевіряємо доступ (інакше IDOR).
  if (projectId && !(await canAccessProject(sUser, projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Активна компанія — та сама, що на всіх сторінках дашборду (кука перемикача Topbar).
  const pid = projectId || (await resolveActiveProject()).activeProject?.id || null;

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
    projectId: pid,
    messages: chatSession.messages,
  });
}
