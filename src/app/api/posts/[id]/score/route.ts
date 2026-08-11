import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRecordProject } from "@/lib/tenant";
import { buildScores } from "@/lib/scoreWeights";

// E2: ввід реакцій поста (лайки/коменти/збереження/підписки/продажі) → зважений бал → PostGroup.scores.
// Ці бали агрегуються в /api/patterns і подаються генератору через get_top_patterns.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rec = await prisma.postGroup.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const denied = await guardRecordProject(rec?.projectId);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const reactions = (body.reactions && typeof body.reactions === "object") ? body.reactions : body;
  const scores = buildScores(reactions);
  await prisma.postGroup.update({ where: { id: params.id }, data: { scores } });
  return NextResponse.json({ ok: true, scores });
}
