import { NextRequest, NextResponse } from "next/server";
import { ensureExpertProject, getDossier, putDossier } from "@/lib/sellerDossierStore";

// Досьє експерта для онбордингу ШІ-продавця. Єдине сховище анкети (рішення власника 27.10); Flows лише читає/пише сюди.
// Body: { action: "get" | "put", projectId?, projectName?, state? }. Auth: x-webhook-secret === WEBHOOK_SECRET.
//  get: повертає { projectId, state|null, updatedAt }. Проєкт не знайдено → { projectId: null, state: null } (не помилка).
//  put: зберігає state; якщо проєкту нема, створює його за projectName (як онбординг-save) і повертає projectId.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { action?: string; projectId?: string; projectName?: string; state?: unknown };
  const projectId = String(body.projectId || "").trim() || undefined;
  const projectName = String(body.projectName || "").trim() || undefined;
  if (!projectId && !projectName) return NextResponse.json({ ok: false, error: "projectId або projectName обовʼязкові" }, { status: 400 });

  if (body.action === "get") {
    const project = await ensureExpertProject({ projectId, projectName });
    if (!project) return NextResponse.json({ ok: true, projectId: null, state: null }, { headers: { "Cache-Control": "no-store" } });
    const d = await getDossier(project.id);
    return NextResponse.json({ ok: true, projectId: project.id, state: d ? d.state : null, updatedAt: d ? d.updatedAt : null }, { headers: { "Cache-Control": "no-store" } });
  }
  if (body.action === "put") {
    const st = body.state as { fields?: unknown } | null;
    if (!st || typeof st !== "object" || !st.fields || typeof st.fields !== "object") {
      return NextResponse.json({ ok: false, error: "state має бути обʼєктом із полем fields" }, { status: 400 });
    }
    const project = await ensureExpertProject({ projectId, projectName, create: true });
    if (!project) return NextResponse.json({ ok: false, error: "Проєкт не знайдено" }, { status: 404 });
    const r = await putDossier(project.id, st as Record<string, unknown>);
    return NextResponse.json({ ok: true, projectId: project.id, updatedAt: r.updatedAt });
  }
  return NextResponse.json({ ok: false, error: "action має бути get | put" }, { status: 400 });
}
