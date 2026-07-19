import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const settings = await prisma.scheduleSettings.findUnique({
    where: { projectId: projectId! },
  });

  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { projectId, monday, tuesday, wednesday, thursday, friday, saturday, sunday, sendToTelegram, telegramChatId, digestTime, digestChatId } = body;
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

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
      digestTime: digestTime || null,
      digestChatId: digestChatId || null,
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
      ...(digestTime !== undefined && { digestTime: digestTime || null }),
      ...(digestChatId !== undefined && { digestChatId: digestChatId || null }),
    },
  });

  return NextResponse.json(settings);
}
