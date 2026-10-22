import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prefillPatch } from "@/lib/sellerConfigInput";

// Службовий запис від Flows (x-webhook-secret === WEBHOOK_SECRET). Правила продажу й статус тут змінити НЕ можна (це робить власник у адмінці).
// Body: { projectId, funnelBotId?, templateVersion?, prefill? }
//  • funnelBotId / templateVersion: привʼязка після клонування воронки.
//  • prefill: підказки онбордингу (sellerName, sellerTitle, bookingUrl, bookingNote, allowedContacts, handoffTelegramId):
//    записуються ЛИШЕ в порожні поля, нічого, що вже заповнила людина, не перезаписується.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { projectId?: string; funnelBotId?: string; templateVersion?: string; prefill?: Record<string, unknown> };
  const projectId = String(body.projectId || "").trim();
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return NextResponse.json({ ok: false, error: "Проєкт не знайдено" }, { status: 404 });

  const idRe = /^[A-Za-z0-9._-]{1,80}$/;
  const data: Record<string, unknown> = {};
  if (body.funnelBotId !== undefined) { if (!idRe.test(String(body.funnelBotId))) return NextResponse.json({ ok: false, error: "funnelBotId некоректний" }, { status: 400 }); data.funnelBotId = String(body.funnelBotId); }
  if (body.templateVersion !== undefined) { if (!idRe.test(String(body.templateVersion))) return NextResponse.json({ ok: false, error: "templateVersion некоректний" }, { status: 400 }); data.templateVersion = String(body.templateVersion); }

  let prefilled: string[] = [];
  if (body.prefill && typeof body.prefill === "object") {
    const existing = await prisma.sellerConfig.findUnique({ where: { projectId } });
    const patch = prefillPatch(existing as unknown as Record<string, unknown> | null, body.prefill);
    prefilled = Object.keys(patch);
    Object.assign(data, patch);
  }

  const saved = await prisma.sellerConfig.upsert({ where: { projectId }, create: { projectId, ...data }, update: data });
  return NextResponse.json({ ok: true, funnelBotId: saved.funnelBotId, templateVersion: saved.templateVersion, prefilled });
}
