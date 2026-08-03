import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";
import { DEFAULT_NETWORK_RULES } from "@/lib/seedStructures";
import { DEFAULT_LINK_PLACEMENT, seedDefaultFormats } from "@/lib/formatsSeed";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json([]);
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const networks = await prisma.socialNetwork.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(networks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, name, platformKey, icon, color, sortOrder, rules } = body;
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const network = await prisma.socialNetwork.create({
    // Нова мережа одразу отримує канонічні правила + куди йде лінк (можна відредагувати).
    data: {
      projectId, name, platformKey, icon, color, sortOrder: sortOrder ?? 0,
      rules: rules ?? DEFAULT_NETWORK_RULES[platformKey] ?? null,
      linkPlacement: DEFAULT_LINK_PLACEMENT[platformKey] ?? null,
    },
  });
  // Засіваємо канонічні формати цієї мережі (пост/сторіз/рілс… з медіа-типами).
  await seedDefaultFormats(projectId).catch(() => {});

  return NextResponse.json(network);
}
