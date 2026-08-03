import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const types = await prisma.contentType.findMany({
    where: { projectId: projectId! },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(types);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, name, description, prompt, tone, structure, platforms, postTypes, hookTypes, skeletonKey, minLen, maxLen, rules } = body;
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const type = await prisma.contentType.create({
    data: {
      projectId,
      name,
      description: description || null,
      prompt: prompt || "",
      tone: tone || null,
      structure: structure || null,
      platforms: platforms || [],
      postTypes: postTypes || [],
      hookTypes: hookTypes || [],
      skeletonKey: skeletonKey || null,
      minLen: Number.isFinite(Number(minLen)) ? Number(minLen) : null,
      maxLen: Number.isFinite(Number(maxLen)) ? Number(maxLen) : null,
      rules: rules || null,
    },
  });

  return NextResponse.json({ ok: true, type });
}
