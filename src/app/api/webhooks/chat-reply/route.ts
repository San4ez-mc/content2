import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastToProject } from "@/lib/sse";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "fnk_wh_2026_x9mK4pLqR7vNsT1eYcJdBuAw";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-webhook-token") || req.nextUrl.searchParams.get("token");
  if (token !== WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json();
  const { sessionKey, text, projectId } = body;

  // Save assistant message to DB
  const session = await prisma.chatSession.findUnique({
    where: { sessionKey },
  });

  if (session) {
    await prisma.chatMessage.create({
      data: { sessionId: session.id, role: "assistant", content: text },
    });

    await prisma.chatSession.update({
      where: { id: session.id },
      data: { lastActivity: new Date() },
    });
  }

  // Broadcast to SSE clients
  const pid = projectId || session?.projectId;
  if (pid) {
    broadcastToProject(pid, {
      type: "chat_reply",
      sessionKey,
      text,
    });
  }

  return NextResponse.json({ ok: true });
}
