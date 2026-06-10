import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NetworksView } from "@/components/networks/NetworksView";

export const metadata = { title: "Мережі та розклад" };

export default async function NetworksPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  let projectId: string | null = null;

  if (role === "superadmin") {
    const p = searchParams.projectId
      ? await prisma.project.findUnique({ where: { id: searchParams.projectId } })
      : await prisma.project.findFirst();
    projectId = p?.id || null;
  } else {
    const pu = await prisma.projectUser.findFirst({ where: { userId } });
    projectId = pu?.projectId || null;
  }

  if (!projectId) redirect("/");

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
