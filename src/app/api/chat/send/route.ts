import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastToProject } from "@/lib/sse";

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
  const userMsg = await prisma.chatMessage.create({
    data: { sessionId: chatSession.id, role: "user", content: text },
  });

  await prisma.chatSession.update({
    where: { id: chatSession.id },
    data: { lastActivity: new Date() },
  });

  // Early acknowledgement via SSE only (not saved to DB — ephemeral)
  broadcastToProject(chatSession.projectId, {
    type: "chat_reply",
    sessionKey,
    text: "⏳ Прийнято в роботу. Генерую відповідь — зачекай...",
  });

  // Load recent conversation history (excluding the message we just saved) so the
  // funnel agent can carry multi-turn context — e.g. "propose theme -> user picks".
  const recent = await prisma.chatMessage.findMany({
    where: { sessionId: chatSession.id, id: { not: userMsg.id } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { role: true, content: true },
  });
  const history = recent
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));

  // Forward to Flows (content-manager-web)
  const base = process.env.NEXTAUTH_URL;
  const wh = process.env.WEBHOOK_SECRET;
  const callbackUrl = `${base}/api/webhooks/chat-reply?token=${wh}&sessionKey=${sessionKey}&projectId=${chatSession.projectId}`;
  const importUrl = `${base}/api/posts/bulk-import?token=${wh}`;

  try {
    await fetch(FLOWS_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        sessionId: sessionKey,
        projectId: chatSession.projectId,
        callbackUrl,
        importUrl,
        today: (() => { const d = new Date(); return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getFullYear()).slice(2)}`; })(),
        todayISO: new Date().toISOString().slice(0, 10),
        history,
      }),
    });
  } catch (e) {
    console.error("Flows error:", e);
  }

  return NextResponse.json({ ok: true });
}
