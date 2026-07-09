import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "fnk_wh_2026_x9mK4pLqR7vNsT1eYcJdBuAw";
const FLOWS_API = process.env.FLOWS_API_BASE || "https://flows.fineko.space";

// Proxies flows deep-link click stats to the dashboard (keeps the shared secret server-side).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  try {
    const r = await fetch(
      `${FLOWS_API}/api/tracked-links/stats?token=${WEBHOOK_SECRET}&projectId=${encodeURIComponent(projectId)}`,
      { cache: "no-store" }
    );
    const j = await r.json();
    return NextResponse.json(j);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, byMagnet: [], links: [], totalClicks: 0 });
  }
}
