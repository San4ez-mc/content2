import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const networkId = req.nextUrl.searchParams.get("networkId");
  if (networkId) {
    const net = await prisma.socialNetwork.findUnique({ where: { id: networkId }, select: { projectId: true } });
    const gate = await requireProjectAccess(net?.projectId || null);
    if (isGateError(gate)) return gate.error;
    return NextResponse.json(await prisma.format.findMany({ where: { socialNetworkId: networkId }, orderBy: { sortOrder: "asc" } }));
  }
  const projectId = req.nextUrl.searchParams.get("projectId");
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;
  return NextResponse.json(await prisma.format.findMany({ where: { projectId: projectId! }, orderBy: { sortOrder: "asc" } }));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, socialNetworkId, key, name, mediaTypes, aspect, settings, sortOrder } = body;
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;
  if (!socialNetworkId || !key || !name) return NextResponse.json({ error: "socialNetworkId, key, name required" }, { status: 400 });
  const fmt = await prisma.format.create({
    data: { projectId, socialNetworkId, key, name, mediaTypes: mediaTypes || [], aspect: aspect || null, settings: settings || {}, sortOrder: sortOrder ?? 0 },
  });
  return NextResponse.json(fmt);
}
