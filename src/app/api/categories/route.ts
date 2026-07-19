import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json([]);
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const categories = await prisma.category.findMany({
    where: { projectId },
    include: { socialNetwork: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, socialNetworkId, name, color, description, clientType } = body;
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const category = await prisma.category.create({
    data: { projectId, socialNetworkId, name, color, description, clientType },
    include: { socialNetwork: true },
  });

  return NextResponse.json(category);
}
