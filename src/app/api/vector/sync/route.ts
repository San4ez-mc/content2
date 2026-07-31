import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, isGateError } from "@/lib/tenant";
import { syncStaticToVector } from "@/lib/vector-sync";

// POST /api/vector/sync?projectId=... — повний ре-синк Client Static з БД у вектор.
export async function POST(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const result = await syncStaticToVector(projectId!);
  return NextResponse.json(result);
}
