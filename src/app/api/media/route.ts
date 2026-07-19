import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGateError } from "@/lib/tenant";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");
  const folder = searchParams.get("folder") || null;
  const tag = searchParams.get("tag") || null;
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const where: any = { projectId };
  if (folder) where.folder = folder;
  if (tag) where.tags = { path: "$", array_contains: tag };

  const items = await prisma.mediaItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Get distinct folders
  const folders = await prisma.mediaItem.findMany({
    where: { projectId: projectId!, folder: { not: null } },
    select: { folder: true },
    distinct: ["folder"],
  });

  return NextResponse.json({ items, folders: folders.map((f) => f.folder) });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string;
  const folder = (formData.get("folder") as string) || null;
  const tagsRaw = formData.get("tags") as string;
  const tags = tagsRaw ? JSON.parse(tagsRaw) : [];

  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Save to public/uploads/media/<projectId>/
  const uploadDir = path.join(process.cwd(), "public", "uploads", "media", projectId);
  await mkdir(uploadDir, { recursive: true });

  const ext = path.extname(file.name);
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(uploadDir, safeName);
  await writeFile(filePath, buffer);

  const publicPath = `/uploads/media/${projectId}/${safeName}`;

  const item = await prisma.mediaItem.create({
    data: {
      projectId,
      fileName: file.name,
      filePath: publicPath,
      mimeType: file.type,
      folder,
      tags: tags.length ? tags : [],
    },
  });

  return NextResponse.json({ ok: true, item });
}
