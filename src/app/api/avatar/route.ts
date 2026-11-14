import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";
import { getAvatar, ensureAvatar, avatarPhotos } from "@/lib/avatarDb";

export const dynamic = "force-dynamic";

const FIELDS = ["name", "tagline", "bio", "look", "basePrompt", "photoRules", "videoRules", "voiceRules", "disclosure"] as const;

// GET ?projectId= → { avatar | null, photos[] }
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;
  const avatar = await getAvatar(projectId!);
  return NextResponse.json({ avatar, photos: avatar ? await avatarPhotos(projectId!) : [] });
}

// POST { projectId, preset? } → створює аватара (preset "kira" = заготовка Кіри), ідемпотентно
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const gate = await requireProjectAccess(body.projectId);
  if (isGateError(gate)) return gate.error;
  const avatar = await ensureAvatar(body.projectId, body.preset);
  return NextResponse.json({ avatar });
}

// PUT { projectId, ...поля, refPhotoIds?, isActive? } → зберігає зміни
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const gate = await requireProjectAccess(body.projectId);
  if (isGateError(gate)) return gate.error;
  const data: Record<string, unknown> = {};
  for (const f of FIELDS) if (f in body) data[f] = body[f] === null ? null : String(body[f]);
  if (Array.isArray(body.refPhotoIds)) data.refPhotoIds = body.refPhotoIds.map(String);
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if ("name" in data && !String(data.name || "").trim()) return NextResponse.json({ error: "Імʼя не може бути порожнім" }, { status: 400 });
  const exists = await getAvatar(body.projectId);
  if (!exists) return NextResponse.json({ error: "Аватара ще немає: спершу створіть" }, { status: 404 });
  const avatar = await prisma.avatar.update({ where: { projectId: body.projectId }, data });
  return NextResponse.json({ avatar });
}
