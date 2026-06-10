import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const settings = await prisma.scheduleSettings.findUnique({
    where: { projectId },
  });

  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { projectId, monday, tuesday, wednesday, thursday, friday, saturday, sunday, sendToTelegram, telegramChatId } = body;

  const settings = await prisma.scheduleSettings.upsert({
    where: { projectId },
    create: {
      projectId,
      monday: monday || [],
      tuesday: tuesday || [],
      wednesday: wednesday || [],
      thursday: thursday || [],
      friday: friday || [],
      saturday: saturday || [],
      sunday: sunday || [],
      sendToTelegram: sendToTelegram ?? true,
      telegramChatId,
    },
    update: {
      ...(monday !== undefined && { monday }),
      ...(tuesday !== undefined && { tuesday }),
      ...(wednesday !== undefined && { wednesday }),
      ...(thursday !== undefined && { thursday }),
      ...(friday !== undefined && { friday }),
      ...(saturday !== undefined && { saturday }),
      ...(sunday !== undefined && { sunday }),
      ...(sendToTelegram !== undefined && { sendToTelegram }),
      ...(telegramChatId !== undefined && { telegramChatId }),
    },
  });

  return NextResponse.json(settings);
}
