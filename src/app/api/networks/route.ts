import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";

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
  const { projectId, name, platformKey, icon, color, sortOrder } = body;
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const network = await prisma.socialNetwork.create({
    data: { projectId, name, platformKey, icon, color, sortOrder: sortOrder ?? 0 },
  });

  return NextResponse.json(network);
}
