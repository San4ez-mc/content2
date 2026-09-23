import { redirect } from "next/navigation";
import { resolveActiveProject } from "@/lib/tenant";
import { StorageView } from "@/components/storage/StorageView";

export const metadata = { title: "Сховище" };

export default async function StoragePage({ searchParams }: { searchParams: { projectId?: string } }) {
  const { user, activeProject } = await resolveActiveProject(searchParams.projectId);
  if (!user) redirect("/login");
  if (!activeProject) redirect("/");

  return <StorageView projectId={activeProject.id} />;
}
