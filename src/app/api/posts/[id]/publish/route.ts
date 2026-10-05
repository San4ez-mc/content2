import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRecordProject } from "@/lib/tenant";
import { broadcastToProject } from "@/lib/sse";

type Ctx = { params: { id: string } };

const SCHEDULER_TOKEN = process.env.SCHEDULER_TOKEN || "fnk_scheduler_2026";
const TG_FLOWS_URL = "https://flows.fineko.space/webhook/bot/content-scheduler";

// Воронки-публікатори за замовчуванням (якщо в мережі не задано autopostSlug).
const DEFAULT_PUBLISHER: Record<string, string> = {
  tiktok: "publish-tiktok",
  youtube: "publish-youtube-shorts",
  threads: "publish-threads",
};
const VIDEO_PLATFORMS = new Set(["tiktok", "youtube"]);
const isVideoPath = (p?: string | null) => !!p && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(p);

// Ручна публікація «зараз» з модалки поста. Той самий шлях, що й у планувальника (Flows content-scheduler →
// publish-* воронка → callback scheduler-done), але без очікування дати/часу й без Telegram-дайджесту.
//   POST body: { force?: boolean }  — force дозволяє повторно опублікувати вже опублікований пост.
export async function POST(req: NextRequest, { params }: Ctx) {
  const group = await prisma.postGroup.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { orderIndex: "asc" } }, socialNetwork: true },
  });
  if (!group) return NextResponse.json({ ok: false, error: "Пост не знайдено" }, { status: 404 });
  const denied = await guardRecordProject(group.projectId);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const force = body?.force === true;
  const platformKey = group.socialNetwork.platformKey;
  const slug = group.socialNetwork.autopostSlug || DEFAULT_PUBLISHER[platformKey];
  if (!slug) return NextResponse.json({ ok: false, error: `Для мережі «${group.socialNetwork.name}» немає автопублікатора` }, { status: 400 });

  const first = group.items[0];
  if (!first || (!first.content && !first.imagePath)) return NextResponse.json({ ok: false, error: "У пості немає контенту" }, { status: 400 });
  if (VIDEO_PLATFORMS.has(platformKey)) {
    if (!isVideoPath(first.imagePath)) return NextResponse.json({ ok: false, error: "Відео ще не згенероване — дочекайся завершення рендера" }, { status: 400 });
    if (first.generationStatus && first.generationStatus !== "done") return NextResponse.json({ ok: false, error: "Відео ще генерується" }, { status: 400 });
  }

  // «Замок»: один запис publication_queue на пост, щоб подвійний клік/cron не опублікували двічі.
  const existing = await prisma.publicationQueue.findUnique({ where: { postGroupId: group.id } });
  if (existing && !force) {
    if (existing.status === "published") return NextResponse.json({ ok: false, code: "already_published", error: "Пост уже опубліковано" }, { status: 409 });
    if (existing.status === "pending" && Date.now() - existing.scheduledAt.getTime() < 10 * 60 * 1000) {
      return NextResponse.json({ ok: false, code: "in_progress", error: "Публікація вже виконується — зачекай кілька хвилин" }, { status: 409 });
    }
  }
  await prisma.publicationQueue.upsert({
    where: { postGroupId: group.id },
    create: { postGroupId: group.id, platform: platformKey, scheduledAt: new Date(), status: "pending" },
    update: { platform: platformKey, scheduledAt: new Date(), status: "pending", errorMessage: null },
  });

  const schedule = await prisma.scheduleSettings.findFirst({ where: { projectId: group.projectId }, select: { telegramChatId: true } });
  const now = new Date();
  const todayStr = new Date(now.getTime() + (3 * 60 - now.getTimezoneOffset()) * 60000).toISOString().slice(0, 10);

  try {
    const res = await fetch(TG_FLOWS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "publish",
        projectId: group.projectId,
        telegramChatId: schedule?.telegramChatId || "",
        posts: [{
          id: group.id,
          platform: platformKey,
          type: group.type,
          scheduleTime: group.scheduleTime,
          sendToTelegram: false,
          postDirectly: true,
          autopostSlug: slug,
          hook: group.hookA || null,
          formatKey: group.formatKey || null,
          items: group.items.map((i) => ({
            content: i.content,
            imagePath: i.imagePath,
            mediaKind: i.imagePath ? (isVideoPath(i.imagePath) ? "video" : "image") : null,
            isCta: i.isCta,
          })),
        }],
        today: todayStr,
        callbackUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/scheduler-done?token=${encodeURIComponent(SCHEDULER_TOKEN)}`,
      }),
    });
    if (!res.ok) throw new Error(`Flows content-scheduler HTTP ${res.status}`);
  } catch (e: any) {
    await prisma.publicationQueue.update({ where: { postGroupId: group.id }, data: { status: "failed", errorMessage: String(e?.message || e).slice(0, 500) } });
    return NextResponse.json({ ok: false, error: `Не вдалося запустити публікацію: ${e?.message || e}` }, { status: 502 });
  }

  broadcastToProject(group.projectId, { type: "post_updated", source: "publisher" });
  return NextResponse.json({ ok: true, publisher: slug, message: "Публікацію запущено. Результат прийде в Telegram, статус поста оновиться автоматично." });
}
