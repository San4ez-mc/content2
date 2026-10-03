import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, isGateError } from "@/lib/tenant";
import { saveFactCore, expireFactCore, updateFactCore, listFactsCore, collectStalePosts } from "@/lib/factsDb";

// Сторінка «Актуальна інформація»: факти з датами (актуально / заплановано / застаріло).
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const r = await listFactsCore(projectId!, "all");
  const stalePosts = await collectStalePosts(projectId!, r.today);
  return NextResponse.json({ today: r.today, facts: r.facts, stalePosts });
}

// Додати факт вручну (так само замінює діючий факт тієї ж теми).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const gate = await requireProjectAccess(body.projectId);
  if (isGateError(gate)) return gate.error;
  const r = await saveFactCore(body.projectId, { ...body, addedBy: "user" });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: r.id, replaced: r.replaced, stalePosts: r.stale.length });
}

// expire:true — позначити факт застарілим; інакше — правка полів факту на місці.
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const gate = await requireProjectAccess(body.projectId);
  if (isGateError(gate)) return gate.error;
  if (body.expire) {
    const r = await expireFactCore(body.projectId, { id: body.id });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 404 });
    return NextResponse.json({ ok: true, expired: r.expired });
  }
  const r = await updateFactCore(body.projectId, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
