import nodemailer, { type Transporter } from "nodemailer";

// SMTP-мейлер. Конфіг з env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE,
// EMAIL_FROM. Якщо SMTP_HOST не заданий — sendMail повертає false (лист не пішов).
let transporter: Transporter | null = null;
function getTransport(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export async function sendMail(opts: { to: string; subject: string; html: string; text?: string }): Promise<boolean> {
  const t = getTransport();
  if (!t) return false;
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || "no-reply@fineko.space";
  await t.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
  return true;
}
