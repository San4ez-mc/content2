import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const maxDuration = 60;
import { prisma } from "@/lib/prisma";
import { broadcastToProject } from "@/lib/sse";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "fnk_wh_2026_x9mK4pLqR7vNsT1eYcJdBuAw";

async function downloadAndSaveImage(
  url: string,
  subFolder: string,
  projectId: string
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const buf = Buffer.from(await res.arrayBuffer());
  const uploadDir = path.join(process.cwd(), "public", "uploads", "media", subFolder);
  await mkdir(uploadDir, { recursive: true });
  const fileName = `generated_${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await writeFile(path.join(uploadDir, fileName), buf);
  const filePath = `/uploads/media/${subFolder}/${fileName}`;
  await prisma.mediaItem.create({
    data: {
      projectId,
      fileName,
      filePath,
      mimeType: contentType,
      folder: "generated",
      aiGenerated: true,
      tags: [],
    },
  });
  return filePath;
}

async function saveBase64Image(
  base64: string,
  subFolder: string,
  projectId: string,
  ext = "png"
): Promise<string> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "media", subFolder);
  await mkdir(uploadDir, { recursive: true });
  const fileName = `generated_${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const rawBase64 = base64.includes(",") ? base64.split(",")[1] : base64;
  const buf = Buffer.from(rawBase64, "base64");
  await writeFile(path.join(uploadDir, fileName), buf);
  const filePath = `/uploads/media/${subFolder}/${fileName}`;
  await prisma.mediaItem.create({
    data: {
      projectId,
      fileName,
      filePath,
      mimeType: `image/${ext}`,
      folder: "generated",
      aiGenerated: true,
      tags: [],
    },
  });
  return filePath;
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
    body.postItemId ||
    null;

  let projectId = body.projectId || req.nextUrl.searchParams.get("projectId") || "misc";
  let existingPostItem: any = null;
  if (postItemId) {
    existingPostItem = await prisma.postItem.findUnique({
      where: { id: postItemId },
      include: { group: { select: { projectId: true } } },
    });
    if (existingPostItem?.group?.projectId) projectId = existingPostItem.group.projectId;
  }

  // Use postItemId as subfolder only when postItem actually exists; otherwise use generated
  const subFolder = (postItemId && existingPostItem) ? postItemId : "generated";

  let imagePath: string | null = body.imagePath || null;

  const externalUrl: string | null = body.imageUrl || body.image_url || body.url || null;
  if (!imagePath && externalUrl) {
    if (externalUrl.startsWith("http")) {
      try {
        imagePath = await downloadAndSaveImage(externalUrl, subFolder, projectId);
      } catch {
        imagePath = externalUrl;
      }
    } else {
      imagePath = externalUrl;
    }
  }

  if (!imagePath && body.imageBase64) {
    imagePath = await saveBase64Image(body.imageBase64, subFolder, projectId);
  }

  if (!imagePath && Array.isArray(body.slidesBase64) && body.slidesBase64.length > 0) {
    const paths: string[] = [];
    for (const b64 of body.slidesBase64) {
      paths.push(await saveBase64Image(b64, subFolder, projectId));
    }
    imagePath = paths[0];
  }

  const errorMessage = body.errorMessage || body.error || null;

  const STATUS_MAP: Record<string, string> = { success: "done", ok: "done", error: "failed" };
  let status: string = body.status;
  if (status) status = STATUS_MAP[status] ?? status;
  if (!status) {
    if (imagePath) status = "done";
    else if (errorMessage) status = "failed";
    else status = "failed";
  }

  if (postItemId && existingPostItem) {
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

    broadcastToProject(projectId, {
      type: "generation_update",
      postItemId,
      postGroupId: updated.groupId,
      status,
      imagePath,
      errorMessage,
    });

    if (status === "done" || status === "failed") {
      const projectUsers = await prisma.projectUser.findMany({
        where: { projectId },
      });

      const networkName = updated.group.socialNetwork?.name ?? "Мережа";
      const d = updated.group.postDate;
      const dateLabel = `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getFullYear()).slice(2)}`;

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
  } else {
    broadcastToProject(projectId, {
      type: "generation_update",
      postItemId: null,
      status,
      imagePath,
    });
  }

  return NextResponse.json({ ok: true, postItemId, status, imagePath });
}
