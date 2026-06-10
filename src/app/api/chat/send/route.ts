import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const FLOWS_WEBHOOK = "https://flows.fineko.space/webhook/bot/content-manager-web";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionKey, text } = await req.json();
  const userId = (session.user as any).id;

  const chatSession = await prisma.chatSession.findUnique({
    where: { sessionKey },
    include: { project: true },
  });

  if (!chatSession || chatSession.userId !== userId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Save user message
  await prisma.chatMessage.create({
    data: { sessionId: chatSession.id, role: "user", content: text },
  });

  await prisma.chatSession.update({
    where: { id: chatSession.id },
    data: { lastActivity: new Date() },
  });

  // Forward to Flows (content-manager-web)
  const callbackUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/chat-reply?token=${process.env.WEBHOOK_SECRET}&sessionKey=${sessionKey}&projectId=${chatSession.projectId}`;

  try {
    await fetch(FLOWS_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        sessionId: sessionKey,
        projectId: chatSession.projectId,
        callbackUrl,
        today: new Date().toISOString().slice(0, 10),
      }),
    });
  } catch (e) {
    console.error("Flows error:", e);
  }

  return NextResponse.json({ ok: true });
}
