import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AdminView } from "@/components/admin/AdminView";

export const metadata = { title: "Адмін панель" };

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } });
  if (user?.role !== "superadmin") redirect("/");

  const [users, projects] = await Promise.all([
    prisma.user.findMany({
      include: { projectUsers: { include: { project: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.project.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <AdminView
      users={JSON.parse(JSON.stringify(users.map((u) => ({
        id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt,
        projects: u.projectUsers.map((pu) => ({ id: pu.project.id, name: pu.project.name, role: pu.role })),
      }))))}
      projects={JSON.parse(JSON.stringify(projects))}
    />
  );
}
