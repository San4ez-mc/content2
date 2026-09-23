import { redirect } from "next/navigation";
import { resolveActiveProject } from "@/lib/tenant";
import { ContentTypesView } from "@/components/content-types/ContentTypesView";

export const metadata = { title: "Структури" };

export default async function StructuresPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const { user, activeProject } = await resolveActiveProject(searchParams.projectId);
  if (!user) redirect("/login");
  if (!activeProject) redirect("/");

  return <ContentTypesView projectId={activeProject.id} />;
}
