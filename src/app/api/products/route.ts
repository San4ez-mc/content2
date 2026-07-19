import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const products = await prisma.product.findMany({
    where: { projectId: projectId! },
    include: { leadMagnets: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, name, description, price, audience } = body;
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
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
