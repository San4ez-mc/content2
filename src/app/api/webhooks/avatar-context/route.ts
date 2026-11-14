import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { avatarContext, ensureAvatar, AVATAR_FOLDER, AVATAR_GEN_FOLDER, absUrl } from "@/lib/avatarDb";
import { composePhotoPrompt } from "@/lib/avatar";

// Аватар для воронок Flows (фото й відео): правила, референси, готовий промпт нового фото; збереження результату в Сховище.
// Auth: x-webhook-secret === WEBHOOK_SECRET.
//  { action:"context", projectId, shot?, scene?, aspect?, outfit?, ribbon?, topic? } → { avatar, brief, rules, refs[], prompt? }
//  { action:"save_media", projectId, url | base64, fileName?, folder?: "avatar"|"avatar-generated", tags?[] } → { item }
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (req.headers.get("x-webhook-secret") !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const b = (await req.json().catch(() => ({}))) as any;
  const projectId = String(b.projectId || "");
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId обовʼязковий" }, { status: 400 });
  const action = String(b.action || "context");

  // Службові дії налаштування (скрипти): створити аватара із заготовки і задати порядок референсів
  if (action === "ensure") {
    const a = await ensureAvatar(projectId, b.preset);
    if (Array.isArray(b.refPhotoIds)) await prisma.avatar.update({ where: { projectId }, data: { refPhotoIds: b.refPhotoIds.map(String) } });
    return NextResponse.json({ ok: true, avatarId: a.id, name: a.name });
  }

  if (action === "context") {
    const ctx = await avatarContext(projectId, { shot: b.shot });
    if (!ctx) return NextResponse.json({ ok: false, error: "У проєкту немає активного аватара" }, { status: 404 });
    const a = await prisma.avatar.findUnique({ where: { projectId } });
    const prompt = b.scene ? composePhotoPrompt(a as any, { scene: String(b.scene), shot: b.shot, aspect: b.aspect, outfit: b.outfit, ribbon: b.ribbon, topic: b.topic, extra: b.extra }) : undefined;
    return NextResponse.json({ ok: true, ...ctx, prompt });
  }

  if (action === "save_media") {
    const folder = b.folder === AVATAR_FOLDER ? AVATAR_FOLDER : AVATAR_GEN_FOLDER;
    let buf: Buffer;
    let mime = String(b.mimeType || "image/jpeg");
    if (b.base64) buf = Buffer.from(String(b.base64), "base64");
    else if (b.url) {
      const r = await fetch(String(b.url));
      if (!r.ok) return NextResponse.json({ ok: false, error: `Не вдалося завантажити: ${r.status}` }, { status: 400 });
      mime = r.headers.get("content-type") || mime;
      buf = Buffer.from(await r.arrayBuffer());
    } else return NextResponse.json({ ok: false, error: "потрібен url або base64" }, { status: 400 });
    if (buf.length > 25 * 1024 * 1024) return NextResponse.json({ ok: false, error: "файл завеликий" }, { status: 400 });
    const ext = mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : mime.includes("mp4") ? ".mp4" : ".jpg";
    const dir = path.join(process.cwd(), "public", "uploads", "media", projectId);
    await mkdir(dir, { recursive: true });
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    await writeFile(path.join(dir, safe), buf);
    const filePath = `/uploads/media/${projectId}/${safe}`;
    const tags = Array.isArray(b.tags) ? b.tags.map(String) : [];
    const item = await prisma.mediaItem.create({
      data: { projectId, fileName: String(b.fileName || safe), filePath, mimeType: mime, folder, tags, aiGenerated: folder === AVATAR_GEN_FOLDER },
    });
    return NextResponse.json({ ok: true, item: { id: item.id, url: absUrl(filePath), path: filePath, folder, tags } });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
