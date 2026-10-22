import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildBrief } from "@/lib/sellerBriefDb";

// Бриф ШІ-продавця для воронки Flows: усе, що продавець знає про експерта, одним документом + готові блоки для промпту.
// Викликається нодою «Завантажити експерта» на початку КОЖНОЇ розмови; воронка нічого про експерта не зберігає.
// Body: { projectId | projectName, telegramId? }. telegramId потрібен для рішення «чи можна цій людині говорити з продавцем» (access).
// Auth: x-webhook-secret === WEBHOOK_SECRET. Відповідь НЕ кешується.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { projectId?: string; projectName?: string; telegramId?: string | number };
  const projectId = body.projectId || req.nextUrl.searchParams.get("projectId") || undefined;
  let pid = projectId;
  if (!pid && body.projectName) {
    const p = await prisma.project.findFirst({ where: { name: body.projectName }, select: { id: true } });
    pid = p?.id;
  }
  if (!pid) return NextResponse.json({ ok: false, error: "projectId або projectName обовʼязкові" }, { status: 400 });

  const brief = await buildBrief(pid, body.telegramId == null ? null : String(body.telegramId));
  if (!brief) return NextResponse.json({ ok: false, error: "Проєкт не знайдено" }, { status: 404 });
  return NextResponse.json(brief, { headers: { "Cache-Control": "no-store" } });
}
