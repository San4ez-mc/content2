import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncContentTools } from "@/lib/toolsSync";

export async function POST(req: Request) {
  // Синхронізація вручну з адмінки (сесія) або зі скриптів Flows після додавання воронки (секрет вебхуків)
  const session = await getServerSession(authOptions);
  const bySecret = !!process.env.WEBHOOK_SECRET && req.headers.get("x-webhook-secret") === process.env.WEBHOOK_SECRET;
  if (!session && !bySecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const synced = await syncContentTools();

  return NextResponse.json({ ok: true, synced });
}
