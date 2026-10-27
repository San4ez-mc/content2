import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSessionUser, canAccessProject } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { NetworkDetailView } from "@/components/networks/NetworkDetailView";

export const metadata = { title: "Мережа" };

export default async function NetworkDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const network = await prisma.socialNetwork.findUnique({ where: { id: params.id } });
  if (!network) notFound();

  // Доступ до проєкту мережі: через спільну перевірку (SSO для SSO-входу, членство для старого входу за паролем)
  const user = await getSessionUser();
  if (!user || !(await canAccessProject(user, network.projectId))) redirect("/networks");

  const formats = await prisma.format.findMany({ where: { socialNetworkId: network.id }, orderBy: { sortOrder: "asc" } });

  return (
    <NetworkDetailView
      network={JSON.parse(JSON.stringify(network))}
      formats={JSON.parse(JSON.stringify(formats))}
    />
  );
}
