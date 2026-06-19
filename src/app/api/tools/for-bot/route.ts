import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public endpoint for content-manager bot — no auth required
export async function GET() {
  const tools = await prisma.contentTool.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      slug: true,
      name: true,
      aiDescription: true,
      exampleOutput: true,
      paramsSchema: true,
    },
  });

  return NextResponse.json({ tools });
}
