import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { resolveActiveProject } from "@/lib/tenant";
import { NetworksView } from "@/components/networks/NetworksView";

export const metadata = { title: "Мережі та розклад" };

export default async function NetworksPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const { user, activeProject } = await resolveActiveProject(searchParams.projectId);
  if (!user) redirect("/login");
  if (!activeProject) redirect("/");
  const projectId = activeProject.id;

  const [networks, scheduleSettings] = await Promise.all([
    prisma.socialNetwork.findMany({ where: { projectId }, orderBy: { sortOrder: "asc" } }),
    prisma.scheduleSettings.findUnique({ where: { projectId } }),
  ]);

  return (
    <NetworksView
      projectId={projectId}
      networks={JSON.parse(JSON.stringify(networks))}
      schedule={scheduleSettings ? JSON.parse(JSON.stringify(scheduleSettings)) : null}
    />
  );
}
