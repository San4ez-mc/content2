import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Каталог проєктів content2 для панелі доступів SSO (контракт: GET /api/auth/sso/projects, x-sso-secret = SSO_CLIENT_SECRET).
// SSO показує ці проєкти в «Компаніях» і зберігає, хто до яких має доступ; content2 читає це назад через /oauth/permissions.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-sso-secret") || "";
  if (!process.env.SSO_CLIENT_SECRET || secret !== process.env.SSO_CLIENT_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const projects = await prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return NextResponse.json({ projects }, { headers: { "Cache-Control": "no-store" } });
}
