import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { seedGlobalKnowledge } from "@/lib/seedGlobalKnowledge";

// Одноразовий засів методології маркетолога (архетипи/25 схем/типи контенту/
// цикл «7 дотиків») у спільну вектор-колекцію "global". Деталі й застереження —
// src/lib/seedGlobalKnowledge.ts. Body: { anchorProjectId: string, force?: boolean }.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { anchorProjectId, force } = await req.json().catch(() => ({}) as any);
  if (!anchorProjectId) return NextResponse.json({ error: "anchorProjectId required" }, { status: 400 });

  const result = await seedGlobalKnowledge(anchorProjectId, !!force);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
