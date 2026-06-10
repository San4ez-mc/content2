import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastToProject } from "../../sse/project/[id]/route";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "fnk_wh_2026_x9mK4pLqR7vNsT1eYcJdBuAw";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-webhook-token") || req.nextUrl.searchParams.get("token");
  if (token !== WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { postItemId, postGroupId, status, imagePath, errorMessage } = body;

  if (postItemId) {
    // Update post item generation status
    const updated = await prisma.postItem.update({
      where: { id: postItemId },
      data: {
        generationStatus: status, // 'generating' | 'done' | 'failed'
        ...(imagePath ? { imagePath } : {}),
        ...(errorMessage ? { generationError: errorMessage } : {}),
      },
      include: { group: { select: { projectId: true } } },
    });

    // Notify via SSE
    broadcastToProject(updated.group.projectId, {
      type: "generation_update",
      postItemId,
      postGroupId: updated.groupId,
      status,
      imagePath,
      errorMessage,
    });

    // Create notification if done or failed
    if (status === "done" || status === "failed") {
      const group = await prisma.postGroup.findUnique({
        where: { id: updated.groupId },
        include: { projectUsers: { include: { user: true } }, socialNetwork: true },
      });

      if (group) {
        // Get all project users to notify
        const projectUsers = await prisma.projectUser.findMany({
          where: { projectId: group.projectId },
        });

        for (const pu of projectUsers) {
          await prisma.notification.create({
            data: {
              projectId: group.projectId,
              userId: pu.userId,
              type: status === "done" ? "generation_done" : "generation_failed",
              title: status === "done" ? "✅ Зображення готове" : "❌ Помилка генерації",
              body: status === "done"
                ? `Зображення для поста від ${group.postDate.toLocaleDateString("uk-UA")} (${group.socialNetwork.name}) готове`
                : `Помилка генерації: ${errorMessage || "невідома помилка"}`,
              postGroupId: group.id,
            },
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
