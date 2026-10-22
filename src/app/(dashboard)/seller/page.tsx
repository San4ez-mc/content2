import { redirect } from "next/navigation";
import { resolveActiveProject } from "@/lib/tenant";
import { SellerView } from "@/components/seller/SellerView";

export const metadata = { title: "ШІ-продавець" };

export default async function SellerPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const { user, activeProject } = await resolveActiveProject(searchParams.projectId);
  if (!user) redirect("/login");
  if (!activeProject) redirect("/");

  return <SellerView projectId={activeProject.id} />;
}
