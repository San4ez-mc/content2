import { redirect } from "next/navigation";
import { resolveActiveProject } from "@/lib/tenant";
import { ProductsView } from "@/components/products/ProductsView";

export const metadata = { title: "Продукти" };

export default async function ProductsPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const { user, activeProject } = await resolveActiveProject(searchParams.projectId);
  if (!user) redirect("/login");
  if (!activeProject) redirect("/");

  return <ProductsView projectId={activeProject.id} />;
}
