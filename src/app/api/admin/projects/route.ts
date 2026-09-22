import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedDefaultStructures, seedDefaultSocialNetworks } from "@/lib/seedStructures";

async function requireSuperadmin(session: any) {
  const user = await prisma.user.findUnique({ where: { id: session?.user?.id } });
  return user?.role === "superadmin" ? user : null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !(await requireSuperadmin(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { projectUsers: true, postGroups: true } } },
  });

  return NextResponse.json(
    projects.map((p) => ({
      id: p.id,
      name: p.name,
      isActive: p.isActive,
      createdAt: p.createdAt,
      usersCount: p._count.projectUsers,
      postsCount: p._count.postGroups,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !(await requireSuperadmin(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const name = String(body?.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Назва компанії обов'язкова" }, { status: 400 });
  }

  const existing = await prisma.project.findFirst({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "Компанія з такою назвою вже існує" }, { status: 400 });
  }

  const project = await prisma.project.create({ data: { name } });
  // Нова компанія одразу отримує канонічні структури постів і базові канали
  // (як і при створенні через онбординг-воронку), щоб не було порожньо.
  await seedDefaultStructures(project.id).catch(() => {});
  await seedDefaultSocialNetworks(project.id).catch(() => {});

  return NextResponse.json({ ok: true, project });
}
