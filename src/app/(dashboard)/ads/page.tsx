import { redirect } from "next/navigation";
import { resolveActiveProject } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { AdsView } from "@/components/ads/AdsView";

export const metadata = { title: "Реклама FB/IG" };
export const dynamic = "force-dynamic";

// Усі рекламні креативи активної компанії (мережа «Реклама FB/IG») на одній сторінці: з картинкою/відео,
// текстом для Ads Manager і кнопками «копіювати». Календар для цього незручний (десятки плашок в одній клітинці).
export default async function AdsPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const { user, activeProject } = await resolveActiveProject(searchParams.projectId);
  if (!user) redirect("/login");
  if (!activeProject) redirect("/");

  const network = await prisma.socialNetwork.findFirst({ where: { projectId: activeProject.id, platformKey: "meta_ads" }, select: { id: true } });
  const groups = network
    ? await prisma.postGroup.findMany({
        where: { projectId: activeProject.id, socialNetworkId: network.id },
        include: { items: { orderBy: { orderIndex: "asc" }, take: 1 } },
        orderBy: { number: "desc" },
        take: 300,
      })
    : [];

  const rows = groups.map((g) => {
    const it = g.items[0];
    const fp = ((it?.funnelParams as any) || {}) as any;
    return {
      id: g.id,
      number: g.number,
      date: g.postDate.toISOString().slice(0, 10),
      status: g.status as string,
      format: g.formatKey || "",
      imagePath: it?.imagePath || null,
      generationStatus: it?.generationStatus || null,
      generationError: (it as any)?.generationError || null,
      content: it?.content || "",
      ad: fp.ad || null,
      violations: Array.isArray(fp.adViolations) ? (fp.adViolations as string[]) : [],
    };
  });

  return <AdsView projectName={activeProject.name} hasNetwork={!!network} rows={rows} />;
}
