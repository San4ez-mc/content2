import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const products = await prisma.product.findMany({
    where: { projectId },
    include: { leadMagnets: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { projectId, name, description, price, audience } = body;

  if (!projectId || !name) {
    return NextResponse.json({ error: "projectId, name required" }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      projectId,
      name,
      description: description || null,
      price: price || null,
      audience: audience || null,
    },
  });

  return NextResponse.json({ ok: true, product });
}
