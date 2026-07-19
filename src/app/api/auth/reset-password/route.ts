import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Відновлення пароля — крок 2: встановити новий пароль за токеном.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "").trim();
  const password = String(body.password || "");
  if (!token || !password) return NextResponse.json({ error: "token і password обовʼязкові" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Пароль має бути не менше 6 символів" }, { status: 422 });

  const rec = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) {
    return NextResponse.json({ error: "Посилання недійсне або протерміноване. Запроси нове." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: rec.userId }, data: { passwordHash } });
  await prisma.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } });

  return NextResponse.json({ ok: true, message: "Пароль оновлено. Тепер увійди з новим паролем." });
}
