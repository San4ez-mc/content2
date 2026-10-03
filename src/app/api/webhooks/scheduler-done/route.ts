import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastToProject } from "@/lib/sse";

const SCHEDULER_TOKEN = process.env.SCHEDULER_TOKEN || "fnk_scheduler_2026";

// Результат прямої публікації: його викликають воронки publish-* (Threads/TikTok/YouTube…) і
// content-scheduler. Раніше цього роуту не існувало (scheduler передавав callbackUrl у нікуди), тож
// PostGroup.status ніколи не ставав "published", а publication_queue вічно лишався "pending".
//   POST ?token=…  body: { postGroupId, status: "published"|"failed", platform?, externalId?, url?, error? }
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-scheduler-token") || req.nextUrl.searchParams.get("token");
  if (token !== SCHEDULER_TOKEN) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const postGroupId = String(body.postGroupId || req.nextUrl.searchParams.get("postGroupId") || "");
  const status = body.status === "published" ? "published" : body.status === "failed" ? "failed" : "";
  if (!postGroupId || !status) return NextResponse.json({ ok: false, error: "postGroupId and status required" }, { status: 400 });

  const group = await prisma.postGroup.findUnique({ where: { id: postGroupId }, select: { id: true, projectId: true, number: true } });
  if (!group) return NextResponse.json({ ok: false, error: "post not found" }, { status: 404 });

  const externalId = String(body.externalId || body.threadId || body.videoId || body.publishId || "").slice(0, 200) || null;
  const errorMessage = status === "failed" ? String(body.error || body.publishError || "unknown error").slice(0, 1000) : null;

  await prisma.publicationQueue.upsert({
    where: { postGroupId },
    create: { postGroupId, platform: String(body.platform || "unknown"), scheduledAt: new Date(), status, externalId, errorMessage },
    update: { status, ...(externalId ? { externalId } : {}), errorMessage },
  });

  if (status === "published") {
    await prisma.postGroup.update({ where: { id: postGroupId }, data: { status: "published" } });
  } else {
    // Не вдалося опублікувати — повертаємо в чернетки, щоб це не виглядало «запланованим», і сповіщаємо команду.
    await prisma.postGroup.update({ where: { id: postGroupId }, data: { status: "draft" } });
    const members = await prisma.projectUser.findMany({ where: { projectId: group.projectId }, select: { userId: true } });
    for (const m of members) {
      await prisma.notification.create({
        data: {
          projectId: group.projectId, userId: m.userId, type: "publish_failed", postGroupId,
          title: `Пост #${group.number} не опубліковано`, body: errorMessage || "unknown error",
        },
      }).catch(() => {});
    }
  }
  broadcastToProject(group.projectId, { type: "post_updated", source: "publisher" });
  return NextResponse.json({ ok: true, status });
}
