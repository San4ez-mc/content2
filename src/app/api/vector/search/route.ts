import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, isGateError } from "@/lib/tenant";
import { ensureProjectVector } from "@/lib/vector-sync";
import { vectorSearch } from "@/lib/vector";

// POST /api/vector/search — скоуплений семантичний пошук по індексах компанії (+global).
// body: { projectId, query, collections?, limit? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { projectId, query, collections, limit } = body as {
    projectId?: string; query?: string; collections?: ("static" | "dynamic" | "global")[]; limit?: number;
  };
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;
  if (!query?.trim()) return NextResponse.json({ error: "query required" }, { status: 400 });

  const token = await ensureProjectVector(projectId!);
  if (!token) {
    // СТОП-правило КБ (Ф0.4в): чесно повідомляємо, не вигадуємо.
    return NextResponse.json({ ok: false, reason: "База знань недоступна. Спробуйте пізніше." }, { status: 503 });
  }

  const results = await vectorSearch(token, query, { collections, limit });
  if (results === null) {
    return NextResponse.json({ ok: false, reason: "Пошук у базі знань тимчасово недоступний." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, results });
}
