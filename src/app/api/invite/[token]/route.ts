import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const invitation = await prisma.invitation.findUnique({
    where: { token: params.token },
  });

  if (!invitation) return NextResponse.json({ error: "Запрошення не знайдено" }, { status: 404 });
  if (invitation.usedAt) return NextResponse.json({ error: "Запрошення вже використано" }, { status: 400 });
  if (new Date() > invitation.expiresAt) return NextResponse.json({ error: "Запрошення застаріло" }, { status: 400 });

  const { name, password } = await req.json();
  if (!name || !password || password.length < 8) {
    return NextResponse.json({ error: "Ім'я та пароль (мін 8 символів) обов'язкові" }, { status: 400 });
  }

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existing) return NextResponse.json({ error: "Користувач з таким email вже існує" }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 10);

  // Create user + link to project in transaction
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: invitation.email,
        name,
        passwordHash,
        role: "client",
      },
    });

    await tx.projectUser.create({
      data: {
        userId: user.id,
        projectId: invitation.projectId,
        role: invitation.role,
      },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { usedAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true });
}
