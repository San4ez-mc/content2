import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CategoriesView } from "@/components/categories/CategoriesView";

export const metadata = { title: "Категорії" };

async function getProjectId(userId: string, role: string, searchProjectId?: string) {
  if (role === "superadmin") {
    const p = searchProjectId
      ? await prisma.project.findUnique({ where: { id: searchProjectId } })
      : await prisma.project.findFirst();
    return p?.id || null;
  }
  const pu = searchProjectId
    ? await prisma.projectUser.findUnique({ where: { userId_projectId: { userId, projectId: searchProjectId } } })
    : await prisma.projectUser.findFirst({ where: { userId } });
  return pu?.projectId || null;
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  const projectId = await getProjectId(userId, role, searchParams.projectId);
  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <div>
          <div className="text-4xl mb-4">📁</div>
          <p className="text-fg-muted text-sm">Немає проектів</p>
        </div>
      </div>
    );
  }

  const [categories, networks, personas] = await Promise.all([
    prisma.category.findMany({
      where: { projectId },
      include: { socialNetwork: true },
      orderBy: { name: "asc" },
    }),
    prisma.socialNetwork.findMany({
      where: { projectId, isEnabled: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.persona.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <CategoriesView
      projectId={projectId}
      categories={JSON.parse(JSON.stringify(categories))}
      networks={JSON.parse(JSON.stringify(networks))}
      personas={JSON.parse(JSON.stringify(personas))}
    />
  );
}
