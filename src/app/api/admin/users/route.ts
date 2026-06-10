import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

async function requireSuperadmin(session: any) {
  const user = await prisma.user.findUnique({ where: { id: session?.user?.id } });
  return user?.role === "superadmin" ? user : null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !(await requireSuperadmin(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    include: {
      projectUsers: { include: { project: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
      projects: u.projectUsers.map((pu) => ({
        id: pu.project.id,
        name: pu.project.name,
        role: pu.role,
      })),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !(await requireSuperadmin(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { email, name, password, role, projectId, projectRole } = body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Користувач з таким email вже існує" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: hash,
      role: role || "client",
      ...(projectId && {
        projectUsers: {
          create: [{ projectId, role: projectRole || "viewer" }],
        },
      }),
    },
  });

  return NextResponse.json({ id: user.id, email: user.email, name: user.name });
}
