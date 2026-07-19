import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

// Відновлення пароля — крок 1: згенерувати токен і посилання.
// Локально/без SMTP повертаємо devLink у відповіді; на проді — лист (TODO SMTP).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });

  let devLink: string | undefined;
  if (user) {
    // прибрати старі невикористані токени цього юзера
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 година
    await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });

    const base = process.env.NEXTAUTH_URL || "http://localhost:3001";
    const link = `${base}/reset-password/${token}`;
    // eslint-disable-next-line no-console
    console.log("[forgot-password] reset link for", email, "->", link);
    if (!process.env.SMTP_HOST) {
      devLink = link; // без SMTP (локально) — віддаємо лінк прямо
    } else {
      // TODO(prod): надіслати лист із посиланням через SMTP
    }
  }

  // не розкриваємо, чи існує акаунт
  return NextResponse.json({
    ok: true,
    message: "Якщо акаунт із таким email існує, ми надіслали посилання для скидання пароля.",
    ...(devLink ? { devLink } : {}),
  });
}
