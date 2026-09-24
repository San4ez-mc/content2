import { prisma } from "@/lib/prisma";
import { CalendarView } from "@/components/calendar/CalendarView";
import { ScheduleBar } from "@/components/schedule/ScheduleBar";
import { redirect } from "next/navigation";
import { resolveActiveProject } from "@/lib/tenant";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { projectId?: string; month?: string };
}) {
  const { user, activeProject } = await resolveActiveProject(searchParams.projectId);
  if (!user) redirect("/login");

  if (!activeProject) {
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

  const scheduleSettings = await prisma.scheduleSettings.findUnique({ where: { projectId: activeProject.id } });

  return (
    <div className="flex flex-col h-[calc(100vh-40px)] overflow-hidden">
      <ScheduleBar
        projectId={activeProject.id}
        initial={scheduleSettings ? JSON.parse(JSON.stringify(scheduleSettings)) : null}
      />
      <div className="flex-1 min-h-0 [&>div]:!h-full">
        <CalendarView
          activeProject={activeProject}
          postGroups={JSON.parse(JSON.stringify(postGroups))}
          socialNetworks={JSON.parse(JSON.stringify(socialNetworks))}
          monthStr={monthStr}
        />
      </div>
    </div>
  );
}
