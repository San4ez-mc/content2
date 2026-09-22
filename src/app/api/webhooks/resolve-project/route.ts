import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Пошук компанії (Project) за назвою — для перемикання компанії з Telegram
// (`/start onboard <назва>`). Точний збіг (без регістру) має пріоритет, інакше —
// підрядок. Не мутує дані, тільки читає.
// Auth: заголовок x-webhook-secret === WEBHOOK_SECRET.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  }

  const exact = await prisma.project.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });
  const project =
    exact ||
    (await prisma.project.findFirst({
      where: { name: { contains: name, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
    }));

  if (!project) {
    return NextResponse.json({ ok: false, error: "not found" });
  }

  return NextResponse.json({ ok: true, id: project.id, name: project.name });
}
