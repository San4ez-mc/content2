import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (role !== "superadmin" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { email, projectId, projectRole } = body;

  if (!email || !projectId) {
    return NextResponse.json({ error: "email and projectId required" }, { status: 400 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await prisma.invitation.create({
    data: {
      email,
      projectId,
      token,
      role: projectRole || "editor",
      expiresAt,
      createdBy: (session.user as any).id,
    },
    include: { project: true },
  });

  const base = process.env.NEXTAUTH_URL;
  const inviteUrl = `${base}/invite/${token}`;

  return NextResponse.json({ ok: true, inviteUrl, invitation });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");

  const invitations = await prisma.invitation.findMany({
    where: projectId ? { projectId } : {},
    include: { project: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(invitations);
}
