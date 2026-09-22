import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireSuperadmin(session: any) {
  const user = await prisma.user.findUnique({ where: { id: session?.user?.id } });
  return user?.role === "superadmin" ? user : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !(await requireSuperadmin(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, isActive } = body;

  if (name !== undefined && !String(name).trim()) {
    return NextResponse.json({ error: "Назва компанії обов'язкова" }, { status: 400 });
  }

  const project = await prisma.project.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(isActive !== undefined && { isActive: !!isActive }),
    },
  });

  return NextResponse.json({ ok: true, project });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !(await requireSuperadmin(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Компанію не знайдено" }, { status: 404 });
  }

  // Захист від випадкового видалення: клієнт має підтвердити точну назву компанії.
  const body = await req.json().catch(() => ({}));
  if (String(body?.confirmName || "").trim() !== project.name) {
    return NextResponse.json({ error: "Назва для підтвердження не збігається" }, { status: 400 });
  }

  // Каскадно видаляє весь контент компанії (пости, персони, продукти тощо — onDelete: Cascade).
  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
