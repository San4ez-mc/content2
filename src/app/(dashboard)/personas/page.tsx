import { redirect } from "next/navigation";
import { resolveActiveProject } from "@/lib/tenant";
import { PersonasView } from "@/components/personas/PersonasView";

export const metadata = { title: "Персони" };

export default async function PersonasPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const { user, activeProject } = await resolveActiveProject(searchParams.projectId);
  if (!user) redirect("/login");
  if (!activeProject) redirect("/");

  return <PersonasView projectId={activeProject.id} />;
}
