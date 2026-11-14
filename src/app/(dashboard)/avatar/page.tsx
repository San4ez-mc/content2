import { redirect } from "next/navigation";
import { resolveActiveProject } from "@/lib/tenant";
import { AvatarView } from "@/components/avatar/AvatarView";

export const metadata = { title: "Аватар" };

export default async function AvatarPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const { user, activeProject } = await resolveActiveProject(searchParams.projectId);
  if (!user) redirect("/login");
  if (!activeProject) redirect("/");

  return <AvatarView projectId={activeProject.id} />;
}
