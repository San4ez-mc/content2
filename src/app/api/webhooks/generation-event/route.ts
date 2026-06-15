import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { broadcastToProject } from "@/lib/sse";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "fnk_wh_2026_x9mK4pLqR7vNsT1eYcJdBuAw";

async function saveBase64Image(base64: string, folder: string, ext = "png"): Promise<string> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "generated", folder);
  await mkdir(uploadDir, { recursive: true });
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buf = Buffer.from(base64, "base64");
  await writeFile(path.join(uploadDir, fileName), buf);
  return `/uploads/generated/${folder}/${fileName}`;
}

export async function POST(req: NextRequest) {
  const token =
    req.headers.get("x-webhook-token") ||
    req.nextUrl.searchParams.get("token");
  if (token !== WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const postItemId =
    req.nextUrl.searchParams.get("postItemId") ||
    body.postItemId;

  // Save base64 image to disk if provided instead of URL
  let imagePath =
    body.imagePath ||
    body.imageUrl ||
    body.image_url ||
    body.url ||
    null;

  if (!imagePath && body.imageBase64) {
    const folder = postItemId || "misc";
    imagePath = await saveBase64Image(body.imageBase64, folder);
  }

  const errorMessage = body.errorMessage || body.error || null;

  // Auto-derive status if not provided
  let status: string = body.status;
  if (!status) {
    if (imagePath) status = "done";
    else if (errorMessage) status = "failed";
    else status = "failed";
  }

  if (!postItemId) {
    return NextResponse.json({ ok: false, error: "postItemId required (body or ?postItemId=)" }, { status: 400 });
  }

  // Update post item generation status
  const updated = await prisma.postItem.update({
    where: { id: postItemId },
    data: {
      generationStatus: status as any,
      ...(imagePath ? { imagePath } : {}),
      ...(errorMessage ? { generationError: errorMessage } : {}),
    },
    include: {
      group: {
        include: { socialNetwork: true },
      },
    },
  });

  const projectId = updated.group.projectId;

  // Notify via SSE
  broadcastToProject(projectId, {
    type: "generation_update",
    postItemId,
    postGroupId: updated.groupId,
    status,
    imagePath,
    errorMessage,
  });

  // Create notification for all project users if done or failed
  if (status === "done" || status === "failed") {
    const projectUsers = await prisma.projectUser.findMany({
      where: { projectId },
    });

    const networkName = updated.group.socialNetwork?.name ?? "Мережа";
    const dateLabel = updated.group.postDate.toLocaleDateString("uk-UA");

    for (const pu of projectUsers) {
      await prisma.notification.create({
        data: {
          projectId,
          userId: pu.userId,
          type: status === "done" ? "generation_done" : "generation_failed",
          title: status === "done" ? "✅ Зображення готове" : "❌ Помилка генерації",
          body:
            status === "done"
              ? `Зображення для поста від ${dateLabel} (${networkName}) готове`
              : `Помилка генерації для поста від ${dateLabel}: ${errorMessage || "невідома помилка"}`,
          postGroupId: updated.groupId,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, postItemId, status });
}
