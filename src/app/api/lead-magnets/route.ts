import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");
  const productId = searchParams.get("productId");
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const magnets = await prisma.leadMagnet.findMany({
    where: { projectId: projectId!, ...(productId ? { productId } : {}) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(magnets);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, productId, name, description, funnelSlug, botUsername, baseStartParam } = body;
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;
  if (!productId || !name) {
    return NextResponse.json({ error: "productId, name required" }, { status: 400 });
  }

  // Ensure the product belongs to this project
  const product = await prisma.product.findFirst({ where: { id: productId, projectId } });
  if (!product) return NextResponse.json({ error: "Product not found in project" }, { status: 400 });

  const magnet = await prisma.leadMagnet.create({
    data: {
      projectId,
      productId,
      name,
      description: description || null,
      funnelSlug: funnelSlug || null,
      botUsername: botUsername || null,
      baseStartParam: baseStartParam || null,
    },
  });

  return NextResponse.json({ ok: true, magnet });
}
