import { NextRequest, NextResponse } from "next/server";

// Сторінки content2 для панелі SSO: окремих грантів по сторінках у content2 немає (доступ іде за проєктом), тож список порожній.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-sso-secret") || "";
  if (!process.env.SSO_CLIENT_SECRET || secret !== process.env.SSO_CLIENT_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ pages: [] }, { headers: { "Cache-Control": "no-store" } });
}
