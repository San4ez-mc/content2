import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json([]);

  const personas = await prisma.persona.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(personas);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { projectId, name, age, gender, type, pains, goals, tone, forbiddenWords } = body;

  const persona = await prisma.persona.create({
    data: { projectId, name, age, gender, type, pains, goals, tone, forbiddenWords },
  });

  return NextResponse.json(persona);
}
