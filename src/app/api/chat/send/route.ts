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

  // Load recent history (last 20 messages)
  const history = await prisma.chatMessage.findMany({
    where: { sessionId: chatSession.id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  // Load active knowledge entries for this project
  const knowledgeEntries = await prisma.knowledgeEntry.findMany({
    where: { projectId: chatSession.projectId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  // Format knowledge as context block
  const knowledgeBlock = knowledgeEntries.length > 0
    ? knowledgeEntries.map((e) => `[${e.category.toUpperCase()}] ${e.title}: ${e.content}`).join("\n")
    : "";

  // Forward to Flows (content-manager-web)
  const base = process.env.NEXTAUTH_URL;
  const wh = process.env.WEBHOOK_SECRET;
  const callbackUrl = `${base}/api/webhooks/chat-reply?token=${wh}&sessionKey=${sessionKey}&projectId=${chatSession.projectId}`;
  const importUrl = `${base}/api/posts/bulk-import?token=${wh}`;
  const saveKnowledgeUrl = `${base}/api/webhooks/save-knowledge`;

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
        saveKnowledgeUrl,
        webhookSecret: wh,
        today: new Date().toISOString().slice(0, 10),
        history: history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        knowledgeBase: knowledgeBlock,
      }),
    });
  } catch (e) {
    console.error("Flows error:", e);
  }

  return NextResponse.json({ ok: true });
}
