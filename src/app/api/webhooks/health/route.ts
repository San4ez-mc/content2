import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Легкий health-чек для вотчдога: перевіряє, що застосунок реально може ходити в БД
// (виявляє «завислий» prisma-пул після рестарту Postgres). Публічний (api/webhooks/*).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, status: "healthy" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 503 });
  }
}
