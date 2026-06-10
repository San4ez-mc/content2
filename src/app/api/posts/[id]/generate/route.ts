import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastToProject } from "@/lib/sse";

type Ctx = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { itemId, imageType, prompt } = body;

  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  const group = await prisma.postGroup.findUnique({
    where: { id: params.id },
    include: { socialNetwork: true, project: true },
  });

  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Mark as generating
  await prisma.postItem.update({
    where: { id: itemId },
    data: {
      generationStatus: "generating",
      imageType,
      imagePrompt: prompt,
      generationError: null,
    },
  });

  // Broadcast SSE: generation started
  broadcastToProject(group.projectId, {
    type: "generation_update",
    postItemId: itemId,
    postGroupId: params.id,
    status: "generating",
  });

  // Send to flows webhook (content-manager bot handles actual generation)
  const webhookBase = process.env.FLOWS_WEBHOOK_BASE;
  const slug = process.env.CONTENT_MANAGER_SLUG || "content-manager-web";
  const webhookSecret = process.env.WEBHOOK_SECRET;

  if (webhookBase && slug) {
    try {
      await fetch(`${webhookBase}/${slug}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-token": webhookSecret || "",
        },
        body: JSON.stringify({
          action: "generate_image",
          itemId,
          groupId: params.id,
          projectId: group.projectId,
          imageType,
          prompt,
          callbackUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/generation-event`,
        }),
      });
    } catch (err) {
      console.error("Failed to trigger generation webhook:", err);
      // Mark as failed if webhook call fails
      await prisma.postItem.update({
        where: { id: itemId },
        data: { generationStatus: "failed", generationError: "Webhook call failed" },
      });
      broadcastToProject(group.projectId, {
        type: "generation_update",
        postItemId: itemId,
        postGroupId: params.id,
        status: "failed",
        errorMessage: "Webhook call failed",
      });
    }
  }

  return NextResponse.json({ ok: true, status: "generating" });
}
