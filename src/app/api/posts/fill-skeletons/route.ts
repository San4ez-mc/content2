import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// E3 фаза J-2: знаходить скелети (skeleton=true), у яких дата публікації вже близько
// (≤ days), і просить контент-бота написати повний текст кожному через edit_post.
// edit_post «випускає» скелет у графік. Викликається кроном. Auth: ?token=WEBHOOK_SECRET.
const FLOWS_WEBHOOK = "https://flows.fineko.space/webhook/bot/content-manager-web";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "fnk_wh_2026_x9mK4pLqR7vNsT1eYcJdBuAw";

async function handle(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== WEBHOOK_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const days = Number(req.nextUrl.searchParams.get("days") || 2);
  const cutoff = new Date(Date.now() + days * 86400000);

  const skeletons = await prisma.postGroup.findMany({
    where: { skeleton: true, postDate: { lte: cutoff } },
    include: { socialNetwork: { select: { platformKey: true } } },
    orderBy: { postDate: "asc" },
    take: 60,
  });
  if (!skeletons.length) return NextResponse.json({ ok: true, skeletons: 0, note: "немає скелетів до дедлайну" });

  const byProject = new Map<string, typeof skeletons>();
  for (const s of skeletons) {
    if (!byProject.has(s.projectId)) byProject.set(s.projectId, []);
    byProject.get(s.projectId)!.push(s);
  }

  const base = process.env.NEXTAUTH_URL || "https://content2.fineko.space";
  const d = new Date();
  const today = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;
  let sent = 0;

  for (const [projectId, list] of byProject) {
    const lines = list.map((s) =>
      `#${s.number} (${s.socialNetwork.platformKey}, формат ${s.formatKey || "post"}${s.structureId ? ", структура " + s.structureId : ""}, дата ${s.postDate.toISOString().slice(0, 10)}, тема «${s.topic || "—"}»)`
    ).join("; ");
    const message = `Наповни скелети повним текстом (фаза J-2). Для КОЖНОГО напиши готовий текст за його платформою/форматом/структурою/темою — дотримуйся правил мережі, стандарту письма й case integrity — і онови через edit_post(number, text). Скелети: ${lines}.`;
    try {
      await fetch(FLOWS_WEBHOOK, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, projectId, importUrl: `${base}/api/posts/bulk-import?token=${WEBHOOK_SECRET}`, today, todayISO: new Date().toISOString().slice(0, 10) }),
      });
      sent += list.length;
    } catch (e: any) {
      console.error("[fill-skeletons] flows send failed:", e?.message);
    }
  }

  return NextResponse.json({ ok: true, skeletons: skeletons.length, sentToFill: sent });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
