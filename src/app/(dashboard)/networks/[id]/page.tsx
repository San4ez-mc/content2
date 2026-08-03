import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { NetworkDetailView } from "@/components/networks/NetworkDetailView";

export const metadata = { title: "Мережа" };

export default async function NetworkDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const network = await prisma.socialNetwork.findUnique({ where: { id: params.id } });
  if (!network) notFound();

  const role = (session.user as any).role;
  const userId = (session.user as any).id;
  if (role !== "superadmin") {
    const pu = await prisma.projectUser.findFirst({ where: { userId, projectId: network.projectId } });
    if (!pu) redirect("/networks");
  }

  const formats = await prisma.format.findMany({ where: { socialNetworkId: network.id }, orderBy: { sortOrder: "asc" } });

  return (
    <NetworkDetailView
      network={JSON.parse(JSON.stringify(network))}
      formats={JSON.parse(JSON.stringify(formats))}
    />
  );
}
