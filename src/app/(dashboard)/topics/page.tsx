import { redirect } from "next/navigation";
import { resolveActiveProject } from "@/lib/tenant";
import { TopicsView } from "@/components/topics/TopicsView";

export const metadata = { title: "Банк тем" };

export default async function TopicsPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const { user, activeProject } = await resolveActiveProject(searchParams.projectId);
  if (!user) redirect("/login");
  if (!activeProject) redirect("/");

  return <TopicsView projectId={activeProject.id} />;
}
