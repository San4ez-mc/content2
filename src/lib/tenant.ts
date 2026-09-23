// #312 Tenant-ізоляція. Централізована перевірка, що залогінений користувач
// справді має доступ до проєкту/запису, який просить (а не просто залогінений).
// До цього роути довіряли projectId з query/body → IDOR між тенантами.
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

export type SessionUser = { id: string; role: string; email?: string };
export type ProjectLite = { id: string; name: string };

// superadmin/admin бачать усі проєкти; client — лише свої (ProjectUser).
const GLOBAL_ROLES = new Set(["superadmin", "admin"]);

// Активна компанія — єдине джерело істини для всіх сторінок дашборду (#перемикач
// у Topbar). Пріоритет: явний override (напр. ?projectId= у deep-лінку) > кука > перша.
export const ACTIVE_PROJECT_COOKIE = "active_project_id";

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string; email?: string } | undefined;
  if (!u?.id) return null;
  return { id: u.id, role: u.role || "client", email: u.email };
}

export async function resolveActiveProject(
  overrideProjectId?: string | null
): Promise<{ user: SessionUser | null; projects: ProjectLite[]; activeProject: ProjectLite | null }> {
  const user = await getSessionUser();
  if (!user) return { user: null, projects: [], activeProject: null };

  const projects: ProjectLite[] = GLOBAL_ROLES.has(user.role)
    ? await prisma.project.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } })
    : (
        await prisma.projectUser.findMany({
          where: { userId: user.id },
          include: { project: { select: { id: true, name: true } } },
          orderBy: { project: { createdAt: "asc" } },
        })
      ).map((pu) => pu.project);

  if (projects.length === 0) return { user, projects: [], activeProject: null };

  const cookieId = cookies().get(ACTIVE_PROJECT_COOKIE)?.value;
  const candidateId = overrideProjectId || cookieId;
  const activeProject = (candidateId && projects.find((p) => p.id === candidateId)) || projects[0];

  return { user, projects, activeProject };
}

export async function canAccessProject(user: SessionUser, projectId: string): Promise<boolean> {
  if (GLOBAL_ROLES.has(user.role)) return true;
  const pu = await prisma.projectUser.findFirst({ where: { userId: user.id, projectId } });
  return !!pu;
}

type Gate = { user: SessionUser } | { error: NextResponse };

/** Для колекційних роутів: логін + доступ до проєкту (projectId з query/body). */
export async function requireProjectAccess(projectId: string | null | undefined): Promise<Gate> {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!projectId) return { error: NextResponse.json({ error: "projectId required" }, { status: 400 }) };
  if (!(await canAccessProject(user, projectId))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

/** Лише логін (для роутів без прив'язки до проєкту). */
export async function requireUser(): Promise<Gate> {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user };
}

/** Лише глобальні ролі (admin-роути). */
export async function requireAdmin(): Promise<Gate> {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!GLOBAL_ROLES.has(user.role)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

/** Для роутів за id запису: перевірити, що projectId запису доступний користувачу.
 *  Повертає null якщо ок, або NextResponse (401/403/404) якщо ні. */
export async function guardRecordProject(projectId: string | null | undefined): Promise<NextResponse | null> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessProject(user, projectId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export function isGateError(g: Gate): g is { error: NextResponse } {
  return "error" in g;
}
