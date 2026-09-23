import { redirect } from "next/navigation";
import { resolveActiveProject } from "@/lib/tenant";
import { StatsView } from "@/components/stats/StatsView";

export const metadata = { title: "Статистика" };

export default async function StatsPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const { user, activeProject } = await resolveActiveProject(searchParams.projectId);
  if (!user) redirect("/login");
  if (!activeProject) redirect("/");

  return <StatsView projectId={activeProject.id} />;
}
