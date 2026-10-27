import { NextRequest, NextResponse } from "next/server";
import { sellerAdminApply, sellerAdminList, sellerAdminView } from "@/lib/sellerAdmin";
import { projectKnowledgeView } from "@/lib/projectKnowledge";

// Адмін-дії ШІ-продавця для сторінки «ШІ-продавці» у Flows (там власник працює з продавцями; content2 лише зберігає дані).
// Body: { action: "list" | "get" | "put" | "knowledge", projectId?, patch? }. Auth: x-webhook-secret === WEBHOOK_SECRET (Flows перевіряє, що користувач superadmin).
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { action?: string; projectId?: string; patch?: Record<string, unknown> };
  const projectId = String(body.projectId || "").trim();

  if (body.action === "list") return NextResponse.json({ ok: true, sellers: await sellerAdminList() });
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });

  if (body.action === "get") {
    const view = await sellerAdminView(projectId);
    if (!view) return NextResponse.json({ ok: false, error: "Проєкт не знайдено" }, { status: 404 });
    return NextResponse.json({ ok: true, ...view }, { headers: { "Cache-Control": "no-store" } });
  }
  if (body.action === "knowledge") {
    const view = await projectKnowledgeView(projectId);
    if (!view) return NextResponse.json({ ok: false, error: "Проєкт не знайдено" }, { status: 404 });
    return NextResponse.json({ ok: true, ...view }, { headers: { "Cache-Control": "no-store" } });
  }
  if (body.action === "put") {
    const r = await sellerAdminApply(projectId, body.patch || {});
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error, missing: r.missing }, { status: r.code });
    return NextResponse.json({ ok: true, status: r.status, readiness: r.readiness });
  }
  return NextResponse.json({ ok: false, error: "action має бути list | get | put | knowledge" }, { status: 400 });
}
