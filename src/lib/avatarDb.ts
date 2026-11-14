import { prisma } from "@/lib/prisma";
import { KIRA_DEFAULT, avatarBrief, pickRefs, type AvatarData, type RefPhoto } from "@/lib/avatar";

const BASE = process.env.NEXTAUTH_URL || "https://content2.fineko.space";
export const AVATAR_FOLDER = "avatar"; // референси (фото, з яких робимо нові)
export const AVATAR_GEN_FOLDER = "avatar-generated"; // нові фото, створені воронкою

export const absUrl = (filePath: string) => (filePath.startsWith("http") ? filePath : BASE + filePath);

export async function getAvatar(projectId: string) {
  return prisma.avatar.findUnique({ where: { projectId } });
}

/** Створює аватара з готової заготовки (preset "kira") або порожнього; ідемпотентно. */
export async function ensureAvatar(projectId: string, preset?: string) {
  const ex = await getAvatar(projectId);
  if (ex) return ex;
  const base: AvatarData = preset === "kira" ? KIRA_DEFAULT : { name: "Аватар" };
  return prisma.avatar.create({ data: { projectId, ...base, name: base.name } });
}

export async function avatarPhotos(projectId: string) {
  const items = await prisma.mediaItem.findMany({
    where: { projectId, folder: { in: [AVATAR_FOLDER, AVATAR_GEN_FOLDER] } },
    orderBy: { createdAt: "asc" },
  });
  return items.map((m) => ({
    id: m.id, fileName: m.fileName, url: absUrl(m.filePath), path: m.filePath, folder: m.folder,
    tags: Array.isArray(m.tags) ? (m.tags as unknown[]).map(String) : [], aiGenerated: m.aiGenerated, createdAt: m.createdAt,
  }));
}

/** Контекст для воронок: правила, бриф, референси для потрібного кадра. */
export async function avatarContext(projectId: string, opts: { shot?: string; max?: number } = {}) {
  const a = await getAvatar(projectId);
  if (!a || !a.isActive) return null;
  const photos = await avatarPhotos(projectId);
  const refPool: RefPhoto[] = photos.filter((p) => p.folder === AVATAR_FOLDER && p.tags.includes("ref")).map((p) => ({ id: p.id, url: p.url, tags: p.tags }));
  const order = Array.isArray(a.refPhotoIds) ? (a.refPhotoIds as unknown[]).map(String) : [];
  const refs = pickRefs(refPool, order, opts.shot, opts.max ?? 3);
  return {
    avatar: { id: a.id, name: a.name, tagline: a.tagline, basePrompt: a.basePrompt, disclosure: a.disclosure },
    brief: avatarBrief(a),
    rules: { look: a.look, photo: a.photoRules, video: a.videoRules, voice: a.voiceRules },
    refs: refs.map((r) => ({ id: r.id, url: r.url, tags: r.tags })),
    refPool: refPool.map((r) => ({ id: r.id, url: r.url, tags: r.tags })),
    scenePhotos: photos.filter((p) => p.folder === AVATAR_FOLDER && !p.tags.includes("ref")).map((p) => ({ id: p.id, url: p.url, tags: p.tags })),
  };
}
