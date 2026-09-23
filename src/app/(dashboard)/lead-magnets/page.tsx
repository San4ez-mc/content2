import { redirect } from "next/navigation";
import { resolveActiveProject } from "@/lib/tenant";
import { LeadMagnetsView } from "@/components/lead-magnets/LeadMagnetsView";

export const metadata = { title: "Лід-магніти" };

export default async function LeadMagnetsPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const { user, activeProject } = await resolveActiveProject(searchParams.projectId);
  if (!user) redirect("/login");
  if (!activeProject) redirect("/");

  return <LeadMagnetsView projectId={activeProject.id} />;
}
