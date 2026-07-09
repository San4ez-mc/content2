import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");
  const productId = searchParams.get("productId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const magnets = await prisma.leadMagnet.findMany({
    where: { projectId, ...(productId ? { productId } : {}) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(magnets);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { projectId, productId, name, description, funnelSlug, botUsername, baseStartParam } = body;

  if (!projectId || !productId || !name) {
    return NextResponse.json({ error: "projectId, productId, name required" }, { status: 400 });
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
