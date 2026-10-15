import { NextRequest, NextResponse } from "next/server";
import { setCreatorResult } from "@/lib/tiktokCreator";

const SCHEDULER_TOKEN = process.env.SCHEDULER_TOKEN || "fnk_scheduler_2026";

// Callback воронки publish-tiktok (action=creator_info): результат запиту creator_info до TikTok.
//   POST ?token=…  body: { requestId, ok, creator?: {...}, error? }
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-scheduler-token") || req.nextUrl.searchParams.get("token");
  if (token !== SCHEDULER_TOKEN) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const requestId = String(body?.requestId || "");
  if (!requestId) return NextResponse.json({ ok: false, error: "requestId required" }, { status: 400 });

  const saved = setCreatorResult(requestId, {
    ok: body.ok === true,
    creator: body.creator && typeof body.creator === "object" ? body.creator : null,
    error: body.ok === true ? null : String(body.error || "unknown error").slice(0, 500),
  });
  return NextResponse.json({ ok: saved });
}
