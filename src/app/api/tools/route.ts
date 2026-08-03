import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tools = await prisma.contentTool.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(tools);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, aiDescription, exampleOutput, isActive, sortOrder } = body;
  let { paramsSchema } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // paramsSchema має бути масивом (Json). Якщо прийшов рядком — розпарсити, щоб не зберігати
  // подвійно-закодований JSON (через це падала сторінка /tools).
  if (typeof paramsSchema === "string") {
    try { const x = JSON.parse(paramsSchema); paramsSchema = Array.isArray(x) ? x : undefined; } catch { paramsSchema = undefined; }
  }
  if (paramsSchema !== undefined && !Array.isArray(paramsSchema)) paramsSchema = undefined;

  const updated = await prisma.contentTool.update({
    where: { id },
    data: {
      ...(aiDescription !== undefined && { aiDescription }),
      ...(exampleOutput !== undefined && { exampleOutput }),
      ...(paramsSchema !== undefined && { paramsSchema }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });

  return NextResponse.json({ ok: true, tool: updated });
}
