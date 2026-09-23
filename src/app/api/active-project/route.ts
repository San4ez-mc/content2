import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, canAccessProject, ACTIVE_PROJECT_COOKIE } from "@/lib/tenant";

// Перемикач компанії (Topbar): зберігає обрану компанію в куці, яку читають
// усі сторінки дашборду через resolveActiveProject.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId || "");
  if (!projectId || !(await canAccessProject(user, projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACTIVE_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
