import { redirect } from "next/navigation";
import { resolveActiveProject } from "@/lib/tenant";
import { FactsView } from "@/components/facts/FactsView";

export const metadata = { title: "Актуальна інформація" };

export default async function FactsPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const { user, activeProject } = await resolveActiveProject(searchParams.projectId);
  if (!user) redirect("/login");
  if (!activeProject) redirect("/");

  return <FactsView projectId={activeProject.id} />;
}
