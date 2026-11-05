import { NextRequest, NextResponse } from "next/server";
import { scanAd } from "@/lib/adRules";

// Перевірка рекламних креативів Meta за правилами (src/lib/adRules.ts): єдине джерело правди для воронок
// ads-creative-image / ads-creative-video. Воронка не тримає власної копії ліміт/політика-правил.
// Body: { ads: AdCreative[], requireLink?: boolean }  →  { ok, anyBad, results: [{ index, violations: string[] }] }
// Auth: x-webhook-secret === WEBHOOK_SECRET.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-webhook-secret") !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { ads?: unknown; requireLink?: boolean };
  const ads = Array.isArray(body.ads) ? body.ads : [];
  const results = ads.map((ad, index) => ({
    index,
    violations: scanAd((ad || {}) as any, { requireLink: body.requireLink !== false }).map((v) => v.detail),
  }));
  return NextResponse.json({ ok: true, anyBad: results.some((r) => r.violations.length > 0), results });
}
