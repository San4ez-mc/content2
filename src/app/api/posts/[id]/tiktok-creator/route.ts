import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRecordProject } from "@/lib/tenant";
import { newCreatorRequest, getCreatorEntry } from "@/lib/tiktokCreator";

type Ctx = { params: { id: string } };

const SCHEDULER_TOKEN = process.env.SCHEDULER_TOKEN || "fnk_scheduler_2026";
const TIKTOK_FLOWS_URL = "https://flows.fineko.space/webhook/bot/publish-tiktok";

async function loadTiktokPost(id: string) {
  const group = await prisma.postGroup.findUnique({ where: { id }, include: { socialNetwork: true } });
  if (!group) return { error: NextResponse.json({ ok: false, error: "Пост не знайдено" }, { status: 404 }) };
  const denied = await guardRecordProject(group.projectId);
  if (denied) return { error: denied };
  if (group.socialNetwork.platformKey !== "tiktok") {
    return { error: NextResponse.json({ ok: false, error: "Це не TikTok-пост" }, { status: 400 }) };
  }
  return { group };
}

// Старт запиту інформації про акаунт TikTok (нік, приватність, заборони). Результат приходить callback-ом
// у /api/webhooks/tiktok-creator; вікно публікації опитує GET нижче.
export async function POST(_req: NextRequest, { params }: Ctx) {
  const loaded = await loadTiktokPost(params.id);
  if ("error" in loaded) return loaded.error;

  const requestId = newCreatorRequest(params.id);
  try {
    const res = await fetch(TIKTOK_FLOWS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "creator_info",
        requestId,
        callbackUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/tiktok-creator?token=${encodeURIComponent(SCHEDULER_TOKEN)}`,
      }),
    });
    if (!res.ok) throw new Error(`Flows publish-tiktok HTTP ${res.status}`);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `Не вдалося запитати дані акаунта TikTok: ${e?.message || e}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true, requestId });
}

// Опитування результату: { ready:false } поки не прийшов callback.
export async function GET(req: NextRequest, { params }: Ctx) {
  const loaded = await loadTiktokPost(params.id);
  if ("error" in loaded) return loaded.error;

  const requestId = req.nextUrl.searchParams.get("requestId") || "";
  const entry = getCreatorEntry(requestId);
  if (!entry || entry.postId !== params.id) return NextResponse.json({ ok: false, error: "Запит не знайдено або застарів" }, { status: 404 });
  if (!entry.result) return NextResponse.json({ ok: true, ready: false });
  return NextResponse.json({ ok: true, ready: true, ...entry.result });
}
