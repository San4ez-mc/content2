import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CalendarView } from "@/components/calendar/CalendarView";
import { redirect } from "next/navigation";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { projectId?: string; month?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session.user as any).id;

  // Get user's projects
  const projectUsers = await prisma.projectUser.findMany({
    where: { userId },
    include: { project: true },
    orderBy: { project: { createdAt: "asc" } },
  });

  // Also include superadmin access to all projects
  const user = await prisma.user.findUnique({ where: { id: userId } });
  let projects = projectUsers.map((pu) => pu.project);

  if (user?.role === "superadmin") {
    projects = await prisma.project.findMany({ orderBy: { createdAt: "asc" } });
  }

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="text-4xl mb-4">📋</div>
          <h2 className="text-lg font-semibold text-fg mb-2">Немає проектів</h2>
          <p className="text-sm text-fg-muted">
            Зверніться до адміністратора для доступу до проекту.
          </p>
        </div>
      </div>
    );
  }

  const activeProjectId = searchParams.projectId || projects[0].id;
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  // Parse month (YYYY-MM)
  const now = new Date();
  const monthStr = searchParams.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, month] = monthStr.split("-").map(Number);

  const dateFrom = new Date(year, month - 1, 1);
  const dateTo = new Date(year, month, 0); // last day of month

  // Fetch post groups for this month
  const postGroups = await prisma.postGroup.findMany({
    where: {
      projectId: activeProject.id,
      postDate: { gte: dateFrom, lte: dateTo },
    },
    include: {
      items: { orderBy: { orderIndex: "asc" } },
      socialNetwork: true,
      persona: true,
    },
    orderBy: { postDate: "asc" },
  });

  const socialNetworks = await prisma.socialNetwork.findMany({
    where: { projectId: activeProject.id, isEnabled: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <CalendarView
      projects={projects}
      activeProject={activeProject}
      postGroups={JSON.parse(JSON.stringify(postGroups))}
      socialNetworks={JSON.parse(JSON.stringify(socialNetworks))}
      monthStr={monthStr}
    />
  );
}
