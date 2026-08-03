import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { seedDefaultStructures, seedDefaultNetworkRules } from "@/lib/seedStructures";

// Засів/бекфіл канонічних структур + правил мереж для проєкту. Ідемпотентно.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { projectId } = await req.json();
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const structures = await seedDefaultStructures(projectId);
  const networkRules = await seedDefaultNetworkRules(projectId);
  return NextResponse.json({ ok: true, structures, networkRules });
}
